import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AnalyzeRequestSchema } from './lib/ai/schemas/index.js';
import { runIntelligencePipeline } from './lib/intelligence.js';
import { createChunks } from './lib/chunker.js';

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
    timestamp: new Date().toISOString(),
  });
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

  // 3. If client didn't chunk, do it server-side
  let { chunks } = request;
  if (!chunks || chunks.length === 0) {
    const allMessages = [];
    return res.status(400).json({ success: false, error: 'No message chunks provided.' });
  }

  console.log(`[Analyze] ${request.metadata.totalMessages} messages · ${chunks.length} chunks · participants: ${request.metadata.participants.join(', ')}`);

  try {
    const intelligence = await runIntelligencePipeline(request, (stage) => {
      console.log(`[Pipeline] ${stage}`);
    });

    return res.json({
      success: true,
      report: intelligence,
    });
  } catch (err) {
    console.error('[Analyze] Pipeline error:', err.message);

    // Don't expose internal errors to client
    const isConfigError = err.message?.includes('GROQ_API_KEY');
    return res.status(500).json({
      success: false,
      error: isConfigError
        ? 'AI configuration error. Check server/.env'
        : 'Analysis failed. Please try again.',
    });
  }
});

// ─── Phase 4 AI Story Generation ──────────────────────────────────────────
app.post('/api/story', async (req, res) => {
  const { GenerateStoryRequestSchema, StorySchema } = await import('./lib/ai/schemas/index.js');
  const { GroqProvider } = await import('./lib/ai/groq.js');
  const { buildStorySystemPrompt, buildStoryUserPrompt } = await import('./lib/ai/prompts/storyPrompt.js');

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
    const provider = new GroqProvider();
    const story = await provider.complete({
      systemPrompt: buildStorySystemPrompt(),
      userPrompt: buildStoryUserPrompt(intelligence, summaryStats, metadata),
      schema: StorySchema,
    });

    return res.json({
      success: true,
      story,
    });
  } catch (err) {
    console.error('[Story] Generation error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Story generation failed. Please try again.',
    });
  }
});

app.listen(PORT, () => {
  const groqOk = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here';
  console.log(`⚡ Afterchat API Server running on port ${PORT}`);
  console.log(`   Phase 3/4: ${groqOk ? '✅ Groq configured' : '⚠️  Set GROQ_API_KEY in server/.env'}`);
});

