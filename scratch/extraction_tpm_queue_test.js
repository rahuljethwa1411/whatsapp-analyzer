import assert from 'node:assert/strict';
import { TokenAwareRequestQueue } from '../server/lib/ai/tokenQueue.js';

let currentTime = 0;
const sleeps = [];
const events = [];
const sleepers = [];

const queue = new TokenAwareRequestQueue({
  maxConcurrent: 2,
  tokenBudget: 100,
  windowMs: 1000,
  now: () => currentTime,
  sleep: ms => new Promise(resolve => {
    sleeps.push(ms);
    sleepers.push(resolve);
  }),
  onEvent: event => events.push(event),
});

const first = await queue.acquire(40, 'req_1');
const second = await queue.acquire(40, 'req_2');

assert.equal(queue.active, 2);
assert.equal(queue.reservedTokens, 80);

const thirdPromise = queue.acquire(40, 'req_3');
await Promise.resolve();
assert.equal(events.some(event => event.type === 'wait' && event.label === 'req_3'), true);

first.release();
second.release();
currentTime = 1000;
sleepers.shift()();
const third = await thirdPromise;

assert.equal(currentTime, 1000);
assert.equal(third.waitMs, 1000);
assert.equal(queue.active, 1);
assert.equal(queue.reservedTokens, 40);
assert.equal(sleeps.some(ms => ms > 0), true);

third.release();
assert.equal(queue.active, 0);

const startEvents = events.filter(event => event.type === 'start');
assert.deepEqual(startEvents.map(event => event.label), ['req_1', 'req_2', 'req_3']);
assert.equal(startEvents[2].waitMs, 1000);
assert.equal(events.filter(event => event.type === 'wait').length >= 1, true);

console.log('extraction TPM queue test passed');
