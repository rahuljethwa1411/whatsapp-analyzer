/**
 * Token-Aware Request Queue — Sliding-Window Concurrency & Rate Limiting Scheduler
 *
 * Implements a rolling-window token bucket scheduler for API limits.
 *
 * Key guarantees:
 *   ✓ Bounded concurrency (e.g. maxConcurrent = 5)
 *   ✓ In-flight requests hold estimated token reservations while running
 *   ✓ Completed requests record actual token usage in a rolling window
 *   ✓ Dynamically wakes up when capacity is freed
 */

export class TokenAwareRequestQueue {
  constructor({
    maxConcurrent = 5,
    tokenBudget = 100000,
    windowMs = 60000,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onEvent = () => {},
  } = {}) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 5);
    this.tokenBudget = Math.max(1, Number(tokenBudget) || 100000);
    this.windowMs = Math.max(1, Number(windowMs) || 60000);
    this.now = now;
    this.sleep = sleep;
    this.onEvent = onEvent;

    this.activeRequests = 0;
    this.activeReservations = []; // { id, taskId, tokens, startedAt }
    this.completedUsage = []; // { id, taskId, tokens, completedAt, expiresAt }
    this.queue = []; // FIFO pending tasks
    this.pendingById = new Map();
    this.schedulerRunning = false;
    this._wakeTimer = null;
    this._lastWaitLog = new Map();
  }

  // Prune completed usage records that have aged out of the rolling window
  pruneExpired() {
    const current = this.now();
    const before = this.completedUsage.length;
    this.completedUsage = this.completedUsage.filter((item) => item.expiresAt > current);
    return before !== this.completedUsage.length;
  }

  // Total tokens committed in the current rolling window
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
      promise,
      resolve: resolveFn,
      reject: rejectFn,
    };

    this.queue.push(task);
    this.pendingById.set(label, task);
    this.onEvent('enqueued', task, this.snapshot());
    this.pump();

    return promise;
  }

  pump() {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;

    try {
      this.clearWakeTimer();
      this.pruneExpired();

      while (this.queue.length > 0) {
        if (this.activeRequests >= this.maxConcurrent) {
          break;
        }

        const head = this.queue[0];
        if (head.reservableTokens > this.availableTokens) {
          const nextExpiry = this.getNextExpiryTime();
          if (nextExpiry !== null) {
            const delayMs = Math.max(25, nextExpiry - this.now() + 10);
            this.setWakeTimer(delayMs);
          }
          break;
        }

        const task = this.queue.shift();
        this.pendingById.delete(task.taskId);
        this.activeRequests++;

        const reservation = {
          id: task.id,
          taskId: task.taskId,
          tokens: task.reservableTokens,
          startedAt: this.now(),
        };
        this.activeReservations.push(reservation);

        let released = false;
        const release = (actualTokens) => {
          if (released) return;
          released = true;

          const idx = this.activeReservations.findIndex((r) => r.id === task.id);
          if (idx !== -1) this.activeReservations.splice(idx, 1);
          this.activeRequests = Math.max(0, this.activeRequests - 1);

          const finalTokens = actualTokens !== undefined && actualTokens !== null
            ? Math.max(1, Math.ceil(Number(actualTokens) || 1))
            : task.reservableTokens;

          const nowMs = this.now();
          this.completedUsage.push({
            id: task.id,
            taskId: task.taskId,
            tokens: finalTokens,
            completedAt: nowMs,
            expiresAt: nowMs + this.windowMs,
          });

          this.pump();
        };

        task.resolve({
          release,
          waitMs: this.now() - task.enqueuedAt,
          requestedTokens: task.requestedTokens,
          reservedTokens: task.reservableTokens,
        });
      }
    } finally {
      this.schedulerRunning = false;
    }
  }

  getNextExpiryTime() {
    if (this.completedUsage.length === 0) return null;
    let earliest = Infinity;
    for (const item of this.completedUsage) {
      if (item.expiresAt < earliest) earliest = item.expiresAt;
    }
    return earliest === Infinity ? null : earliest;
  }

  clearWakeTimer() {
    if (this._wakeTimer) {
      clearTimeout(this._wakeTimer);
      this._wakeTimer = null;
    }
  }

  setWakeTimer(ms) {
    this.clearWakeTimer();
    this._wakeTimer = setTimeout(() => {
      this._wakeTimer = null;
      this.pump();
    }, Math.max(10, ms));
  }
}
