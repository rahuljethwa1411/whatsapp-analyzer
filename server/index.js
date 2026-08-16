import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AnalyzeRequestSchema } from './lib/ai/schemas/index.js';
import { runIntelligencePipeline } from './lib/intelligence.js';
import { DailyLimitError, InvalidApiKeyError, getTokenTelemetry } from './lib/ai/groq.js';

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
    extractionModel: process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    synthesisModel: process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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
  console.log(
    `[Analyze] ${totalMessages.toLocaleString()} messages · ${chunks.length} chunks · ` +
    `participants: ${participants}`
  );

  try {
    const intelligence = await runIntelligencePipeline(request, ({ stage, percent }) => {
      console.log(`[Pipeline] ${stage}${percent !== undefined ? ` (${percent}%)` : ''}`);
    });

    return res.json({
      success: true,
      report: intelligence,
    });
  } catch (err) {
    console.error('[Analyze] Pipeline error:', err.message);

    // Invalid API Key
    if (err instanceof InvalidApiKeyError || err?.code === 'INVALID_API_KEY') {
      return res.status(401).json({
        success: false,
        error: 'Invalid GROQ_API_KEY in server/.env. Please verify your API key or generate a new key at https://console.groq.com/keys',
        code: 'INVALID_API_KEY',
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
        : 'Analysis failed. Please try again.',
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

app.listen(PORT, () => {
  const groqOk = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here';
  const extractionModel = process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const synthesisModel = process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  console.log(`⚡ Afterchat API Server running on port ${PORT}`);
  console.log(`   Phase 3/4: ${groqOk ? '✅ Groq configured' : '⚠️  Set GROQ_API_KEY in server/.env'}`);
  if (groqOk) {
    console.log(`   Extraction model: ${extractionModel}`);
    console.log(`   Synthesis model:  ${synthesisModel}`);
  }
});
