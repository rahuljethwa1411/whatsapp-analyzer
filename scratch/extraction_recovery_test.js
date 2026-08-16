import assert from 'node:assert/strict';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';
import {
  RequestTooLargeError,
  getTokenTelemetry,
  resetTokenTelemetry,
} from '../server/lib/ai/groq.js';

function makeChunk(id, count, options = {}) {
  const messages = Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    const hour = String(index % 24).padStart(2, '0');
    const messageId = `m_${String(index).padStart(3, '0')}`;
    return {
      id: messageId,
      type: 'message',
      timestamp: `2025-01-${day}T${hour}:00:00.000Z`,
      sender: index % 2 === 0 ? 'Asha' : 'Rahul',
      text: options.heavy
        ? `Test message ${messageId} with receipt-worthy content. `.repeat(10)
        : `Test message ${messageId} with receipt-worthy content.`,
    };
  });

  return {
    id,
    startAt: messages[0].timestamp,
    endAt: messages[messages.length - 1].timestamp,
    participants: ['Asha', 'Rahul'],
    messages,
  };
}

function makeProvider(maxMessagesPerRequest) {
  const calls = [];
  return {
    extractionModel: 'fake-extraction',
    synthesisModel: 'fake-synthesis',
    calls,
    async completeRequest({ request }) {
      const userPrompt = request.messages.find(message => message.role === 'user')?.content || '';
      const ids = [...new Set([...userPrompt.matchAll(/\[(m_\d+)\]/g)].map(match => match[1]))];
      calls.push(ids);

      if (ids.length > maxMessagesPerRequest) {
        throw new RequestTooLargeError(`RequestTooLargeError: ${ids.length} messages is too large`);
      }

      return {
        period: {
          start: '2025-01-01T00:00:00.000Z',
          end: '2025-01-28T23:00:00.000Z',
        },
        topics: ['recovery-test', 'Recovery-Test'],
        recurringThemes: ['oversized extraction recovery'],
        evidence: [
          {
            messageId: ids[0],
            type: 'promise',
            importance: 0.8,
            connection: `Recovered evidence for ${ids[0]}`,
          },
        ],
      };
    },
  };
}

async function testOneOversizedChunk() {
  resetTokenTelemetry();
  const provider = makeProvider(50);
  const result = await extractSingleChunkWithRecovery(makeChunk('chunk_1', 100), 0, 1, provider);
  const telemetry = getTokenTelemetry();

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(provider.calls.length, 4);
  assert.deepEqual(provider.calls.map(call => call.length), [25, 25, 25, 25]);
  assert.equal(telemetry.totalRetries, 3);
  assert.equal(telemetry.recoverySplits, 3);
  assert.ok(result.extraction.evidence.length > 0);

  console.log('one oversized chunk: split into chunk_1a/chunk_1b and recovered');
  console.log(`telemetry: retries=${telemetry.totalRetries}, recoverySplits=${telemetry.recoverySplits}`);
}

async function testFiveLogicalChunks() {
  resetTokenTelemetry();
  const provider = makeProvider(50);
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      extractSingleChunkWithRecovery(makeChunk(`chunk_${index + 1}`, 100), index, 5, provider)
    )
  );
  const telemetry = getTokenTelemetry();

  assert.equal(results.filter(result => result.ok).length, 5);
  assert.equal(results.filter(result => result.recovered).length, 5);
  assert.equal(provider.calls.length, 20);
  assert.equal(telemetry.totalRetries, 15);
  assert.equal(telemetry.recoverySplits, 15);

  console.log('five logical chunks: all recovered after split');
  console.log(`telemetry: retries=${telemetry.totalRetries}, recoverySplits=${telemetry.recoverySplits}`);
}

async function testSixtyToThirtyToFifteenShape() {
  resetTokenTelemetry();
  const provider = makeProvider(7);
  const result = await extractSingleChunkWithRecovery(makeChunk('chunk_4', 60, { heavy: true }), 3, 5, provider);
  const telemetry = getTokenTelemetry();
  const sentSizes = provider.calls.map(call => call.length);

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(sentSizes.includes(60), false);
  assert.equal(sentSizes.includes(30), false);
  assert.equal(sentSizes.includes(15), false);
  assert.deepEqual(sentSizes, [4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3]);
  assert.equal(telemetry.totalRetries, 15);
  assert.equal(telemetry.recoverySplits, 15);

  console.log('60->30->15 regression: preflight/fallback recovered without sending 60, 30, or 15-message requests');
  console.log(`provider call sizes: ${sentSizes.join(', ')}`);
}

await testOneOversizedChunk();
await testFiveLogicalChunks();
await testSixtyToThirtyToFifteenShape();
