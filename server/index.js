import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AnalyzeRequestSchema } from './lib/ai/schemas/index.js';
import { runIntelligencePipeline } from './lib/intelligence.js';
import {
  DailyLimitError,
  InvalidApiKeyError,
  ModelNotFoundError,
  RateLimitError,
  getTokenTelemetry,
} from './lib/ai/openaiClient.js';
import { validateModelConfig, getModelForTier } from './lib/ai/modelConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client/dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const configValidation = validateModelConfig();
  res.json({
    status: 'ok',
    service: 'Afterchat Server API (OpenAI Multi-Tier Edition)',
    provider: 'OpenAI',
    openaiConfigured: configValidation.isValid,
    extractionModel: getModelForTier('extraction'),
    evidenceModel: getModelForTier('evidence'),
    storyModel: getModelForTier('story'),
    timestamp: new Date().toISOString(),
  });
});

// ─── Internal Telemetry ───────────────────────────────────────────────────
app.get('/api/telemetry', (req, res) => {
  res.json(getTokenTelemetry());
});

// ─── AI Analysis Endpoint (Tier 1 & Tier 2) ──────────────────────────────
app.post('/api/analyze', async (req, res) => {
  // 1. Validate request shape
  const parseResult = AnalyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format.',
      details: parseResult.error.issues.map((i) => i.message),
    });
  }

  const request = parseResult.data;

  // 2. Check API key configured
  const configCheck = validateModelConfig();
  if (!configCheck.isValid) {
    return res.status(503).json({
      success: false,
      error: 'AI analysis is not configured. Add OPENAI_API_KEY to server/.env',
    });
  }

  // 3. Validate chunks present
  const { chunks } = request;
  if (!chunks || chunks.length === 0) {
    return res.status(400).json({ success: false, error: 'No message chunks provided.' });
  }

  const totalMessages = request.metadata.totalMessages;
  const participants = request.metadata.participants.join(', ');
  const extractionModel = getModelForTier('extraction');
  const evidenceModel = getModelForTier('evidence');

  console.log('\n' + '━'.repeat(60));
  console.log(`🚀 [OPENAI ANALYZE REQUEST RECEIVED]`);
  console.log(`   💬 Total Messages:    ${totalMessages.toLocaleString()}`);
  console.log(`   📦 Logical Chunks:    ${chunks.length}`);
  console.log(`   👥 Participants:      ${participants}`);
  console.log(`   ⚡ Extraction Model:  ${extractionModel}`);
  console.log(`   🧠 Evidence Model:    ${evidenceModel}`);
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
      console.error(`   Stack:\n${err.stack.split('\n').slice(1, 4).map((l) => '     ' + l.trim()).join('\n')}`);
    }
    console.error('═'.repeat(60) + '\n');

    // Invalid API Key
    if (err instanceof InvalidApiKeyError || err?.code === 'INVALID_API_KEY') {
      return res.status(401).json({
        success: false,
        error: 'Invalid OPENAI_API_KEY in server/.env. Please verify your API key at https://platform.openai.com/api-keys',
        code: 'INVALID_API_KEY',
      });
    }

    // Model Not Found (404)
    if (err instanceof ModelNotFoundError || err?.code === 'MODEL_NOT_FOUND' || err.message?.includes('model_not_found')) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'MODEL_NOT_FOUND',
      });
    }

    // Daily limit / Quota exceeded
    if (err instanceof DailyLimitError || err?.code === 'DAILY_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        error: "OpenAI account quota exceeded. Please verify billing at https://platform.openai.com/account/billing",
        code: 'DAILY_LIMIT_EXCEEDED',
      });
    }

    // Rate limit
    if (err instanceof RateLimitError || err?.code === 'RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        error: 'OpenAI rate limit reached. Please try again in a few moments.',
        code: 'RATE_LIMIT_EXCEEDED',
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

    const isConfigError = err.message?.includes('OPENAI_API_KEY');
    return res.status(500).json({
      success: false,
      error: isConfigError
        ? 'AI configuration error. Check server/.env'
        : (err.message || 'Analysis failed. Please try again.'),
    });
  }
});

// ─── AI Story Generation (Story Writer V2 — 10 Chapters via gpt-5.4-mini) ──
app.post('/api/story', async (req, res) => {
  const { GenerateStoryRequestSchema } = await import('./lib/ai/schemas/index.js');
  const { generateCompleteStory } = await import('./lib/storyGenerator.js');

  const parseResult = GenerateStoryRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format for story generation.',
      details: parseResult.error.issues.map((i) => i.message),
    });
  }

  const { intelligence, summaryStats, metadata } = parseResult.data;

  const configCheck = validateModelConfig();
  if (!configCheck.isValid) {
    return res.status(503).json({
      success: false,
      error: 'AI analysis is not configured. Add OPENAI_API_KEY to server/.env',
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
        error: 'OpenAI quota exceeded. Please check your billing settings.',
        code: 'DAILY_LIMIT_EXCEEDED',
      });
    }

    if (err instanceof InvalidApiKeyError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid OpenAI API key.',
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
  const { sendReportEmail } = await import('./lib/mailer.js');

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      participants,
      totalMessages,
      storyTitle,
      overallTone,
      verdict,
    } = req.body || {};

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

    // Trigger asynchronous automated report email dispatch
    if (email && typeof email === 'string' && email.includes('@')) {
      sendReportEmail({
        to: email.trim(),
        participants: participants || 'WhatsApp Chat Participants',
        totalMessages: totalMessages || 0,
        storyTitle: storyTitle || 'The Complete WhatsApp Intelligence Dossier',
        overallTone: overallTone || 'Chaotic Comfort',
        verdict: verdict || 'A legendary conversation archive documented forever.',
        paymentId: razorpay_payment_id,
      }).catch((mailErr) => {
        console.error('[Payment] Automated email dispatch failed:', mailErr.message);
      });
    }

    // Persist full report snapshot for future cross-device and email access
    const { reportSnapshot } = req.body || {};
    if (reportSnapshot) {
      const { saveReportSnapshot } = await import('./lib/reportStore.js');
      saveReportSnapshot(razorpay_payment_id, reportSnapshot);
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: result.message,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      email_dispatched: !!(email && email.includes('@')),
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

// Endpoint to verify HMAC unlock tokens from email links and retrieve saved report
app.post('/api/verify-unlock-token', async (req, res) => {
  const { verifyUnlockToken } = await import('./lib/razorpay.js');
  const { getReportSnapshot } = await import('./lib/reportStore.js');
  const { payment_id, token } = req.body || {};

  if (!payment_id || !token) {
    return res.status(400).json({ success: false, valid: false, error: 'Missing payment_id or token.' });
  }

  const isValid = verifyUnlockToken(payment_id, token);
  const snapshot = isValid ? getReportSnapshot(payment_id) : null;

  return res.json({
    success: true,
    valid: isValid,
    reportSnapshot: snapshot,
    message: isValid ? 'Token verified successfully.' : 'Invalid or tampered unlock token.',
  });
});

// Dedicated endpoint to send or resend full report email
app.post('/api/send-report-email', async (req, res) => {
  const { sendReportEmail } = await import('./lib/mailer.js');

  try {
    const { to, participants, totalMessages, storyTitle, overallTone, verdict, paymentId } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid recipient email address is required.',
      });
    }

    const mailResult = await sendReportEmail({
      to,
      participants,
      totalMessages,
      storyTitle,
      overallTone,
      verdict,
      paymentId: paymentId || 'VERIFIED_PAYMENT',
    });

    return res.status(mailResult.success ? 200 : 500).json(mailResult);
  } catch (err) {
    console.error('[Mailer] Endpoint error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to dispatch report email.',
    });
  }
});

// ─── Static Frontend Serving ─────────────────────────────────────────────
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
  const config = validateModelConfig();
  console.log(`⚡ Afterchat API Server running on port ${PORT}`);
  console.log(`   Provider: OpenAI (${config.isValid ? '✅ Configured' : '⚠️ Set OPENAI_API_KEY in server/.env'})`);
  if (config.isValid) {
    console.log(`   Extraction model: ${config.config.extractionModel}`);
    console.log(`   Evidence model:   ${config.config.evidenceModel}`);
    console.log(`   Story model:      ${config.config.storyModel}`);
  }
  if (fs.existsSync(clientDistPath)) {
    console.log(`   Frontend: Serving client/dist at http://localhost:${PORT}`);
  }
});
