import assert from 'node:assert/strict';
import { buildExtractionRequest, getExtractionRequestDiagnostics } from '../server/lib/ai/extractionRequest.js';
import { estimateExtractionRequest } from '../server/lib/tokenEstimator.js';

function makeMessages(count) {
  const samples = [
    'normal English message with a simple plan for tomorrow',
    'haan yaar kal milte hain, scene sorted?',
    'short',
    'this is a longer message with repeated punctuation!!! and enough words to look realistic in chat exports',
    'emoji heavy 😂😂😂😭😭😭🔥🔥',
    'URL check https://example.com/path?x=1&y=two plus punctuation...',
    'Hinglish mix: mujhe laga you were saying something else only',
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `msg_${String(index + 1).padStart(5, '0')}`,
    type: 'message',
    timestamp: `2025-01-${String((index % 28) + 1).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:15:00.000Z`,
    sender: index % 2 === 0 ? 'Asha' : 'Rahul',
    text: `${samples[index % samples.length]} #${index + 1}`,
  }));
}

function makeChunk(id, messages) {
  return {
    id,
    startAt: messages[0]?.timestamp || '',
    endAt: messages[messages.length - 1]?.timestamp || '',
    sessionIds: ['session_1'],
    participants: ['Asha', 'Rahul'],
    messages,
  };
}

function printDiagnostics(chunk, request, tokenInfo) {
  const diagnostics = getExtractionRequestDiagnostics(request, chunk);
  const rawMessageChars = chunk.messages
    .map(m => `[${m.id}] [${m.timestamp}] ${m.sender || 'Unknown'}: ${m.text}`)
    .join('\n').length;

  console.log(
    [
      '[TokenEstimator Debug]',
      `chunk: ${diagnostics.chunk}`,
      `messages: ${diagnostics.messages}`,
      `raw_message_chars: ${rawMessageChars}`,
      `system_chars: ${diagnostics.systemPromptChars}`,
      `schema_chars: ${diagnostics.schemaChars}`,
      `serialized_request_chars: ${diagnostics.totalSerializedRequestChars}`,
      `estimated_input_tokens: ${tokenInfo.estimatedInputTokens}`,
      `safe_budget: ${tokenInfo.safeBudget}`,
    ].join('\n')
  );
}

for (const count of [1, 5, 10, 15, 20, 30, 40, 60, 120]) {
  const chunk = makeChunk(`sizing_${count}`, makeMessages(count));
  const request = buildExtractionRequest(chunk, 0, 9);
  const tokenInfo = estimateExtractionRequest(request);
  printDiagnostics(chunk, request, tokenInfo);
  assert.equal(request.messages[1].content.includes(`[msg_${String(count).padStart(5, '0')}]`), true);
  assert.equal(tokenInfo.totalSerializedRequestChars, JSON.stringify(request).length);
}

const consistencyChunk = makeChunk('consistency', makeMessages(15));
const requestForEstimate = buildExtractionRequest(consistencyChunk, 3, 10);
const requestForGroq = buildExtractionRequest(consistencyChunk, 3, 10);
assert.deepEqual(requestForEstimate, requestForGroq);
console.log('request consistency: estimator request matches Groq request fields');
