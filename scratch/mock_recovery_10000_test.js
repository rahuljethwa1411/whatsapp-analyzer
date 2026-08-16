import assert from 'node:assert/strict';

process.env.MAX_EXTRACTION_INPUT_TOKENS = '250000';

const { extractSingleChunkWithRecovery } = await import('../server/lib/intelligence.js');
const {
  RequestTooLargeError,
  getTokenTelemetry,
  resetTokenTelemetry,
} = await import('../server/lib/ai/groq.js');

const ORIGINAL_MESSAGES = 10000;
const MOCK_MAX_MESSAGES = 625;
const ROOT_CHUNK_ID = 'mock_chunk_1';

function makeMessages(count) {
  return Array.from({ length: count }, (_, index) => {
    const id = `mock_${String(index + 1).padStart(5, '0')}`;
    const day = String((index % 28) + 1).padStart(2, '0');
    const hour = String(index % 24).padStart(2, '0');
    const minute = String(index % 60).padStart(2, '0');
    return {
      id,
      type: 'message',
      timestamp: `2025-01-${day}T${hour}:${minute}:00.000Z`,
      sender: index % 2 === 0 ? 'Rahul' : 'Asha',
      text: `mock message ${index + 1}`,
    };
  });
}

function makeChunk(id, messages) {
  return {
    id,
    startAt: messages[0].timestamp,
    endAt: messages[messages.length - 1].timestamp,
    participants: ['Rahul', 'Asha'],
    messages,
  };
}

function extractPromptMessageIds(userPrompt) {
  return [...new Set([...userPrompt.matchAll(/\[(mock_\d{5})\]/g)].map(match => match[1]))];
}

function makeMockProvider() {
  const successfulLeaves = [];
  const failedLeaves = [];

  return {
    extractionModel: 'local-mock-extraction',
    synthesisModel: 'not-used',
    successfulLeaves,
    failedLeaves,
    async completeRequest({ request, tier }) {
      assert.equal(tier, 'extraction');
      const userPrompt = request.messages.find(message => message.role === 'user')?.content || '';
      const ids = extractPromptMessageIds(userPrompt);

      if (ids.length > MOCK_MAX_MESSAGES) {
        failedLeaves.push(ids);
        throw new RequestTooLargeError(`RequestTooLargeError: ${ids.length} messages exceeds mock limit ${MOCK_MAX_MESSAGES}`);
      }

      successfulLeaves.push(ids);
      return {
        period: {
          start: '2025-01-01T00:00:00.000Z',
          end: '2025-01-28T23:59:00.000Z',
        },
        topics: ['mock recovery'],
        recurringThemes: ['local extraction recovery'],
        evidence: [
          {
            messageId: ids[0],
            type: 'event',
            importance: 0.9,
            connection: 'Mock evidence',
          },
        ],
      };
    },
  };
}

function buildTree(id, count, limit, depth = 0, maxDepth = 4) {
  if (count <= limit || depth >= maxDepth) return { id, count, children: [] };
  const firstCount = Math.ceil(count / 2);
  const secondCount = count - firstCount;
  return {
    id,
    count,
    children: [
      buildTree(`${id}a`, firstCount, limit, depth + 1, maxDepth),
      buildTree(`${id}b`, secondCount, limit, depth + 1, maxDepth),
    ],
  };
}

function printTree(node, prefix = '', isLast = true, isRoot = true) {
  const connector = isRoot ? '' : isLast ? '`-- ' : '|-- ';
  const line = `${prefix}${connector}${node.id} [${node.count}]`;
  const nextPrefix = isRoot ? '' : `${prefix}${isLast ? '    ' : '|   '}`;
  return [
    line,
    ...node.children.flatMap((child, index) =>
      printTree(child, nextPrefix, index === node.children.length - 1, false)
    ),
  ];
}

function countCoverage(successfulLeaves, allMessages) {
  const assigned = new Map();
  for (const leaf of successfulLeaves) {
    for (const id of leaf) {
      assigned.set(id, (assigned.get(id) || 0) + 1);
    }
  }

  let lost = 0;
  let duplicates = 0;
  for (const message of allMessages) {
    const count = assigned.get(message.id) || 0;
    if (count === 0) lost++;
    if (count > 1) duplicates += count - 1;
  }

  return {
    covered: [...assigned.values()].filter(count => count > 0).length,
    lost,
    duplicates,
  };
}

resetTokenTelemetry();

const messages = makeMessages(ORIGINAL_MESSAGES);
const provider = makeMockProvider();
const result = await extractSingleChunkWithRecovery(makeChunk(ROOT_CHUNK_ID, messages), 0, 1, provider);
const telemetry = getTokenTelemetry();
const coverage = countCoverage(provider.successfulLeaves, messages);

assert.equal(result.ok, true);
assert.equal(result.recovered, true);
assert.equal(telemetry.totalRequests, 0);
assert.equal(provider.successfulLeaves.length, 16);
assert.equal(provider.failedLeaves.length, 14);
assert.equal(telemetry.requestTooLargeHits, 15);
assert.equal(telemetry.recoverySplits, 15);
assert.equal(telemetry.totalRetries, 15);
assert.equal(coverage.covered, ORIGINAL_MESSAGES);
assert.equal(coverage.lost, 0);
assert.equal(coverage.duplicates, 0);
assert.equal(result.extraction.evidence.length, 16);

console.log('================ MOCK RECOVERY TEST ================');
console.log('');
console.log(`Original messages: ${ORIGINAL_MESSAGES}`);
console.log(`Root chunk: ${ROOT_CHUNK_ID}`);
console.log(`Mock size limit: ${MOCK_MAX_MESSAGES}`);
console.log('');
console.log('API requests: 0');
console.log('Groq requests: 0');
console.log('');
console.log(`Size-limit hits: ${telemetry.requestTooLargeHits}`);
console.log(`Recovery splits: ${telemetry.recoverySplits}`);
console.log(`Retries: ${telemetry.totalRetries}`);
console.log('');
console.log(`Successful subchunks: ${provider.successfulLeaves.length}`);
console.log('Failed subchunks: 0');
console.log('');
console.log('Original logical chunks: 1');
console.log('Successful logical chunks: 1');
console.log('Failed logical chunks: 0');
console.log('');
console.log(`Messages covered: ${coverage.covered}`);
console.log(`Messages lost: ${coverage.lost}`);
console.log(`Duplicate message assignments: ${coverage.duplicates}`);
console.log('');
console.log(`Merged evidence: ${result.extraction.evidence.length}`);
console.log('');
console.log(printTree(buildTree(ROOT_CHUNK_ID, ORIGINAL_MESSAGES, MOCK_MAX_MESSAGES)).join('\n'));
console.log('');
console.log('=====================================================');
