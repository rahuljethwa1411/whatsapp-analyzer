/**
 * Token-Aware Request Queue — Sliding-Window TPM Scheduler
 *
 * Implements a rolling-window token bucket scheduler for Groq TPM limits.
 *
 * Key guarantees:
 *   ✓ Bounded concurrency (e.g. maxConcurrent = 2 or 3)
 *   ✓ In-flight requests hold estimated token reservations while running
 *   ✓ Completed requests record actual token usage in a 60-second sliding window
 *   ✓ When tokens are unavailable, schedules precise timer wakeups based on earliest window expiry
 *   ✓ No busy-waiting or arbitrary fixed 30-second pauses
 *   ✓ Guaranteed single-release per reservation
 */

export class TokenAwareRequestQueue {
  constructor({
    maxConcurrent = 2,
    tokenBudget = 12000,
    windowMs = 60000,
    now = () => Date.now(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    onEvent = () => {},
  } = {}) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 1);
    this.tokenBudget = Math.max(1, Number(tokenBudget) || 1);
    this.windowMs = Math.max(1, Number(windowMs) || 60000);
    this.now = now;
    this.sleep = sleep;
    this.onEvent = onEvent;

    this.activeRequests = 0;
    this.activeReservations = []; // { id, taskId, tokens, startedAt }
    this.completedUsage = [];     // { id, taskId, tokens, completedAt, expiresAt }
    this.queue = [];              // FIFO pending tasks
    this.pendingById = new Map();
    this.schedulerRunning = false;
    this._wakeTimer = null;
    this._lastWaitLog = new Map();
  }

  // Prune completed usage records that have aged out of the rolling window
  pruneExpired() {
    const current = this.now();
    const before = this.completedUsage.length;
    this.completedUsage = this.completedUsage.filter(item => item.expiresAt > current);
    return before !== this.completedUsage.length;
  }

  // Total tokens committed in the current rolling window (in-flight + recently completed)
  get reservedTokens() {
    this.pruneExpired();
    const inFlight = this.activeReservations.reduce((sum, item) => sum + item.tokens, 0);
    const completed = this.completedUsage.reduce((sum, item) => sum + item.tokens, 0);
    return inFlight + completed;
  }

  get availableTokens() {
    return Math.max(0, this.tokenBudget - this.reservedTokens);
  }

  snapshot() {
    this.pruneExpired();
    const inFlight = this.activeReservations.reduce((sum, item) => sum + item.tokens, 0);
    const completed = this.completedUsage.reduce((sum, item) => sum + item.tokens, 0);
    return {
      tpmBudget: this.tokenBudget,
      reservedTokens: inFlight + completed,
      inFlightTokens: inFlight,
      completedWindowTokens: completed,
      availableTokens: this.availableTokens,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
      windowMs: this.windowMs,
      queued: this.queue.length,
      activeReservations: this.activeReservations.length,
      completedRecords: this.completedUsage.length,
    };
  }

  /**
   * Acquire reservation for a task.
   * Returns a promise resolving with { release: (actualTokens) => void, waitMs, requestedTokens, reservedTokens }
   */
  acquire(tokens, label = 'request') {
    const requestedTokens = Math.max(1, Math.ceil(Number(tokens) || 1));
    const reservableTokens = Math.min(requestedTokens, this.tokenBudget);

    if (this.pendingById.has(label)) {
      return this.pendingById.get(label).promise;
    }

    let resolveFn, rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const task = {
      id: `${label}:${Math.random().toString(36).slice(2, 8)}`,
      taskId: label,
      requestedTokens,
      reservableTokens,
      enqueuedAt: this.now(),
      resolve: resolveFn,
      reject: rejectFn,
      started: false,
    };

    this.queue.push(task);
    this.pendingById.set(label, { task, promise });
    this.onEvent({ type: 'enqueue', label, snapshot: this.snapshot() });

    this.pumpQueue().catch(err => {
      task.reject(err);
    });

    return promise;
  }

  /**
   * Main scheduler loop: dispatches eligible requests under concurrency & TPM constraints.
   */
  async pumpQueue() {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;

    try {
      if (this._wakeTimer) {
        clearTimeout(this._wakeTimer);
        this._wakeTimer = null;
      }

      while (this.queue.length > 0) {
        this.pruneExpired();

        // 1. Check concurrency limit
        if (this.activeRequests >= this.maxConcurrent) {
          break;
        }

        const task = this.queue[0];
        const currentReserved = this.reservedTokens;
        const canReserve = (currentReserved + task.reservableTokens) <= this.tokenBudget;

        if (!canReserve) {
          // Determine when the next completed token usage will expire out of the window
          let nextAvailableMs = this.windowMs;
          if (this.completedUsage.length > 0) {
            const earliestExpiry = Math.min(...this.completedUsage.map(c => c.expiresAt));
            nextAvailableMs = Math.max(50, earliestExpiry - this.now());
          }

          // Throttle wait log
          const last = this._lastWaitLog.get(task.taskId) || 0;
          if (this.now() - last > 3000) {
            this._lastWaitLog.set(task.taskId, this.now());
            this.onEvent({
              type: 'wait',
              label: task.taskId,
              requestedTokens: task.requestedTokens,
              reservedTokens: task.reservableTokens,
              waitMs: nextAvailableMs,
              snapshot: this.snapshot(),
            });
          }

          // Schedule precise timer wakeup when oldest usage rolls out
          if (!this._wakeTimer) {
            this._wakeTimer = setTimeout(() => {
              this._wakeTimer = null;
              this.pumpQueue().catch(() => {});
            }, nextAvailableMs);
          }
          break;
        }

        // 2. Dispatch task
        const reservationId = `${task.taskId}:${this.now()}:${Math.random().toString(36).slice(2, 6)}`;
        const reservation = {
          id: reservationId,
          taskId: task.taskId,
          tokens: task.reservableTokens,
          startedAt: this.now(),
        };

        this.queue.shift();
        this.pendingById.delete(task.taskId);

        this.activeReservations.push(reservation);
        this.activeRequests++;

        const waitMs = this.now() - task.enqueuedAt;
        this.onEvent({
          type: 'start',
          label: task.taskId,
          requestedTokens: task.requestedTokens,
          reservedTokens: reservation.tokens,
          waitMs,
          snapshot: this.snapshot(),
        });

        let released = false;
        const releaseFn = (actualUsedTokens) => {
          if (released) return;
          released = true;

          // Remove in-flight reservation
          const idx = this.activeReservations.findIndex(r => r.id === reservationId);
          if (idx !== -1) {
            this.activeReservations.splice(idx, 1);
          }
          this.activeRequests = Math.max(0, this.activeRequests - 1);

          // Add completed usage to rolling 60s window
          const finalTokens = actualUsedTokens && Number(actualUsedTokens) > 0
            ? Math.ceil(Number(actualUsedTokens))
            : reservation.tokens;

          this.completedUsage.push({
            id: reservationId,
            taskId: task.taskId,
            tokens: Math.min(finalTokens, this.tokenBudget),
            completedAt: this.now(),
            expiresAt: this.now() + this.windowMs,
          });

          this.onEvent({
            type: 'release',
            label: task.taskId,
            actualTokens: finalTokens,
            snapshot: this.snapshot(),
          });

          // Wake scheduler immediately for next queue items
          setImmediate(() => this.pumpQueue().catch(() => {}));
        };

        try {
          task.resolve({
            release: releaseFn,
            waitMs,
            requestedTokens: task.requestedTokens,
            reservedTokens: reservation.tokens,
          });
        } catch (e) {
          releaseFn();
        }
      }
    } finally {
      this.schedulerRunning = false;
    }
  }

  release(label = 'request') {
    const idx = this.activeReservations.findIndex(r => r.taskId === label);
    if (idx !== -1) {
      const reservation = this.activeReservations.splice(idx, 1)[0];
      this.completedUsage.push({
        id: reservation.id,
        taskId: reservation.taskId,
        tokens: reservation.tokens,
        completedAt: this.now(),
        expiresAt: this.now() + this.windowMs,
      });
    }
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.onEvent({ type: 'release', label, snapshot: this.snapshot() });
    setImmediate(() => this.pumpQueue().catch(() => {}));
  }
}
