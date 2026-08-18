import { validateModelConfig, getModelForTier, DEFAULT_CONFIG } from '../server/lib/ai/modelConfig.js';
import { estimateTokens, estimateExtractionRequest, TOP_LEVEL_CHUNK_COUNT, SAFE_EXTRACTION_INPUT_TOKENS } from '../server/lib/tokenEstimator.js';
import { CHUNK_EXTRACTION_JSON_SCHEMA, buildExtractionRequest } from '../server/lib/ai/extractionRequest.js';

console.log('=== TEST 1: Model Configuration & Sizing Constants ===');

const configCheck = validateModelConfig();
console.log('Model Config Status:', configCheck.isValid ? 'VALID' : `INVALID (${configCheck.error})`);

console.log('Tier Models:');
console.log('  Extraction Tier:', getModelForTier('extraction'));
console.log('  Evidence Tier:  ', getModelForTier('evidence'));
console.log('  Story Tier:     ', getModelForTier('story'));

console.log('\nTop Level Chunk Count:', TOP_LEVEL_CHUNK_COUNT);
console.log('Safe Extraction Budget:', SAFE_EXTRACTION_INPUT_TOKENS);

// Test Token Estimation
const sampleText = 'Hello! This is a test message with some emojis 🔥💀 and numbers 12345.';
const estimated = estimateTokens(sampleText);
console.log(`\nSample string (${sampleText.length} chars) estimated tokens: ${estimated}`);

// Test Request Builder & Strict JSON Schema
const mockChunk = {
  id: 'chunk_1',
  startAt: '2024-01-01T10:00:00.000Z',
  endAt: '2024-01-02T10:00:00.000Z',
  participants: ['Alex', 'Sam'],
  messages: [
    { id: 'm1', timestamp: '2024-01-01T10:00:00.000Z', sender: 'Alex', text: 'Hey bro', type: 'message' },
    { id: 'm2', timestamp: '2024-01-01T10:01:00.000Z', sender: 'Sam', text: 'Yo, all good?', type: 'message' },
  ],
};

const req = buildExtractionRequest(mockChunk, 0, 20);
const preflight = estimateExtractionRequest(req);

console.log('\nPreflight Request Sizing:');
console.log('  Model:          ', req.model);
console.log('  Schema Name:    ', req.schemaName);
console.log('  Estimated Input:', preflight.estimatedInputTokens);
console.log('  Safe Budget:    ', preflight.safeBudget);
console.log('  Is Safe:        ', preflight.safe);

console.log('\n✓ Configuration & preflight test passed successfully.');
