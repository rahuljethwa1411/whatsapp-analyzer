import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AnalyzeRequestSchema } from './lib/ai/schemas/index.js';
import { runIntelligencePipeline } from './lib/intelligence.js';
import { DailyLimitError, InvalidApiKeyError, getTokenTelemetry } from './lib/ai/groq.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client/dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Afterchat Server API',
    phase: 3,
    groqConfigured: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here',
    extractionModel: process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'groq/compound-mini',
    synthesisModel: process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'groq/compound',
    timestamp: new Date().toISOString(),
  });
});

// ─── Internal Telemetry (do NOT expose to client) ──────────────────────────
app.get('/api/telemetry', (req, res) => {
  res.json(getTokenTelemetry());
});

// ─── Phase 3 AI Analysis ──────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  // 1. Validate request shape
  const parseResult = AnalyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format.',
      details: parseResult.error.issues.map(i => i.message),
    });
  }

  const request = parseResult.data;

  // 2. Check API key configured
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    return res.status(503).json({
      success: false,
      error: 'AI analysis is not configured. Add GROQ_API_KEY to server/.env',
    });
  }

  // 3. Validate chunks present
  const { chunks } = request;
  if (!chunks || chunks.length === 0) {
    return res.status(400).json({ success: false, error: 'No message chunks provided.' });
  }

  const totalMessages = request.metadata.totalMessages;
  const participants = request.metadata.participants.join(', ');
  const extractionModel = process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'groq/compound-mini';
  const synthesisModel = process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'groq/compound';

  console.log('\n' + '━'.repeat(60));
  console.log(`🚀 [ANALYZE REQUEST RECEIVED]`);
  console.log(`   💬 Total Messages:    ${totalMessages.toLocaleString()}`);
  console.log(`   📦 Logical Chunks:    ${chunks.length}`);
  console.log(`   👥 Participants:      ${participants}`);
  console.log(`   ⚡ Extraction Model:  ${extractionModel}`);
  console.log(`   🧠 Synthesis Model:   ${synthesisModel}`);
  console.log('━'.repeat(60));

  try {
    const intelligence = await runIntelligencePipeline(request, ({ stage, percent }) => {
      const pctStr = percent !== undefined ? ` [${String(percent).padStart(3, ' ')}%]` : '';
      console.log(`📍 [PIPELINE]${pctStr} ${stage}`);
    });

    console.log(`\n✨ [ANALYZE COMPLETE] Analysis successfully generated.\n`);

    return res.json({
      success: true,
      report: intelligence,
    });
  } catch (err) {
    console.error('\n' + '═'.repeat(60));
    console.error(`❌ [PIPELINE FAILURE] Analysis encountered an error:`);
    console.error(`   Error Message: ${err.message}`);
    if (err.stack && process.env.NODE_ENV !== 'production') {
      console.error(`   Stack:\n${err.stack.split('\n').slice(1, 4).map(l => '     ' + l.trim()).join('\n')}`);
    }
    console.error('═'.repeat(60) + '\n');

    // Invalid API Key
    if (err instanceof InvalidApiKeyError || err?.code === 'INVALID_API_KEY') {
      return res.status(401).json({
        success: false,
        error: 'Invalid GROQ_API_KEY in server/.env. Please verify your API key or generate a new key at https://console.groq.com/keys',
        code: 'INVALID_API_KEY',
      });
    }

    // Model Not Found (404)
    if (err.message?.includes('was not found (404)') || err.message?.includes('model_not_found')) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'MODEL_NOT_FOUND',
      });
    }

    // Daily limit — tell user specifically
    if (err instanceof DailyLimitError || err?.code === 'DAILY_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        error: "We've hit the daily AI analysis limit. Please try again tomorrow, or upgrade your Groq plan for higher limits.",
        code: 'DAILY_LIMIT_EXCEEDED',
      });
    }

    // Incomplete analysis (too many chunks failed)
    if (err.message?.includes('Too many extraction chunks failed')) {
      return res.status(503).json({
        success: false,
        error: 'Analysis could not complete — too many conversation segments failed to process. This may be a temporary API issue. Please try again.',
        code: 'ANALYSIS_INCOMPLETE',
      });
    }

    const isConfigError = err.message?.includes('GROQ_API_KEY');
    return res.status(500).json({
      success: false,
      error: isConfigError
        ? 'AI configuration error. Check server/.env'
        : (err.message || 'Analysis failed. Please try again.'),
    });
  }
});

// ─── Phase 4 AI Story Generation (Story Writer V2 — 10 Chapters) ───────────
app.post('/api/story', async (req, res) => {
  const { GenerateStoryRequestSchema } = await import('./lib/ai/schemas/index.js');
  const { generateCompleteStory } = await import('./lib/storyGenerator.js');
  const { DailyLimitError, InvalidApiKeyError } = await import('./lib/ai/groq.js');

  const parseResult = GenerateStoryRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format for story generation.',
      details: parseResult.error.issues.map(i => i.message),
    });
  }

  const { intelligence, summaryStats, metadata } = parseResult.data;

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    return res.status(503).json({
      success: false,
      error: 'AI analysis is not configured. Add GROQ_API_KEY to server/.env',
    });
  }

  try {
    const { story, receipts } = await generateCompleteStory({
      intelligence,
      summaryStats,
      metadata,
    });

    return res.json({
      success: true,
      story,
      receipts,
    });
  } catch (err) {
    console.error('[Story] Generation error:', err.message);

    if (err instanceof DailyLimitError) {
      return res.status(429).json({
        success: false,
        error: "We've hit the daily AI limit. Please try again tomorrow.",
        code: 'DAILY_LIMIT_EXCEEDED',
      });
    }

    if (err instanceof InvalidApiKeyError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Groq API key.',
        code: 'INVALID_API_KEY',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Story generation failed. Please try again.',
    });
  }
});

// ─── Razorpay Payment Integration ──────────────────────────────────────────
app.post('/api/create-order', async (req, res) => {
  const { createRazorpayOrder } = await import('./lib/razorpay.js');

  try {
    const { amount, currency, receipt, notes } = req.body || {};

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        error: 'Amount in paise is required.',
      });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least 100 paise (1 INR).',
      });
    }

    const order = await createRazorpayOrder({
      amount: numericAmount,
      currency: currency || 'INR',
      receipt,
      notes,
    });

    return res.status(200).json({
      success: true,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (err) {
    console.error('[Payment] Create order error:', err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to create order. Please try again.',
    });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  const { verifyRazorpaySignature } = await import('./lib/razorpay.js');

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
      });
    }

    const result = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!result.verified) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: result.message,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (err) {
    console.error('[Payment] Verify signature error:', err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Payment verification failed.',
    });
  }
});

// ─── Static Frontend Serving (Production / Unified Deployment) ───────────
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  const groqOk = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here';
  const extractionModel = process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'groq/compound-mini';
  const synthesisModel = process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'groq/compound';
  console.log(`⚡ Afterchat API Server running on port ${PORT}`);
  console.log(`   Phase 3/4: ${groqOk ? '✅ Groq configured' : '⚠️  Set GROQ_API_KEY in server/.env'}`);
  if (groqOk) {
    console.log(`   Extraction model: ${extractionModel}`);
    console.log(`   Synthesis model:  ${synthesisModel}`);
  }
  if (fs.existsSync(clientDistPath)) {
    console.log(`   Frontend: Serving client/dist at http://localhost:${PORT}`);
  }
});
