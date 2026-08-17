import assert from 'node:assert/strict';
import { TokenAwareRequestQueue } from '../server/lib/ai/tokenQueue.js';

async function test1() {
  const queue = new TokenAwareRequestQueue({ maxConcurrent: 2, tokenBudget: 10000, windowMs: 60000, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), onEvent: () => {} });
  const tasks = Array.from({ length: 10 }, (_, i) => `task_${i+1}`);
  const results = {};

  const promises = tasks.map(t => {
    return queue.acquire(2800, t).then(res => {
      results[t] = (results[t] || 0) + 1;
      // simulate short run
      return new Promise(r => setTimeout(() => { res.release(); r(); }, 50));
    });
  });

  await Promise.all(promises.map(p => p.catch(e => {})));

  for (const t of tasks) {
    assert.equal(results[t], 1);
  }
  console.log('TEST1 passed: each task executed once');
}

async function test2() {
  // TPM limit 5000, taskA 3000, taskB 3000
  const queue = new TokenAwareRequestQueue({ maxConcurrent: 2, tokenBudget: 5000, windowMs: 60000, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), onEvent: () => {} });
  let order = [];

  const a = queue.acquire(3000, 'A').then(res => {
    order.push('A-start');
    return new Promise(r => setTimeout(() => { res.release(); order.push('A-done'); r(); }, 200));
  });
  const b = queue.acquire(3000, 'B').then(res => {
    order.push('B-start');
    return new Promise(r => setTimeout(() => { res.release(); order.push('B-done'); r(); }, 10));
  });

  await Promise.all([a.catch(()=>{}), b.catch(()=>{})]);
  // B should start only after A-done
  const aDoneIndex = order.indexOf('A-done');
  const bStartIndex = order.indexOf('B-start');
  assert(aDoneIndex !== -1 && bStartIndex > aDoneIndex);
  console.log('TEST2 passed: B waited until A released');
}

(async function run() {
  await test1();
  await test2();
  console.log('Queue tests passed');
})();
