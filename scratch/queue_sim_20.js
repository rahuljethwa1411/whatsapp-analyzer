import assert from 'node:assert/strict';
import { TokenAwareRequestQueue } from '../server/lib/ai/tokenQueue.js';

async function runSim() {
  const queue = new TokenAwareRequestQueue({ maxConcurrent: 1, tokenBudget: 9203, windowMs: 60000, onEvent: (e)=>{} });
  const tasks = Array.from({ length: 20 }, (_, i) => `chunk_sim_${i+1}`);
  const started = new Map();

  const promises = tasks.map((t, idx) => {
    return queue.acquire(2800, t).then(res => {
      started.set(t, (started.get(t) || 0) + 1);
      // stagger runtime to exercise wakeups
      return new Promise(r => setTimeout(() => { res.release(); r(); }, 30 + (idx % 3) * 10));
    });
  });

  await Promise.all(promises.map(p => p.catch(()=>{})));

  for (const t of tasks) {
    assert.equal(started.get(t), 1);
  }
  console.log('TEST3 passed: 20 tasks executed exactly once');
}

runSim().catch(err => { console.error(err); process.exit(1); });
