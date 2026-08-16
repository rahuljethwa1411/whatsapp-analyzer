import fs from 'node:fs';
import path from 'node:path';
import { GroqProvider, getTokenTelemetry, resetTokenTelemetry } from '../server/lib/ai/groq.js';
import { createChunks } from '../server/lib/chunker.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve('server/.env'));

const HEADER_PATTERNS = [
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\s*[\-\u2013]\s*(.+)$/,
  /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\]\s*(.+)$/,
  /^(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\s*[\-\u2013]\s*(.+)$/,
];

const MEDIA_PATTERNS = [
  /<media omitted>/i,
  /image omitted/i,
  /video omitted/i,
  /audio omitted/i,
  /sticker omitted/i,
  /document omitted/i,
  /GIF omitted/i,
  /voice message omitted/i,
  /contact card omitted/i,
  /location omitted/i,
];

const SYSTEM_PATTERNS = [
  /end-to-end encrypted/i,
  /created group/i,
  /added/i,
  /left$/i,
  /removed/i,
  /changed the group/i,
  /changed this group/i,
  /changed the subject/i,
  /changed the icon/i,
  /deleted this message/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /security code changed/i,
];

const EVIDENCE_TYPES = [
  'affection',
  'love',
  'flirting',
  'rejection',
  'conflict',
  'apology',
  'vulnerability',
  'promise',
  'contradiction',
  'behavior',
  'turning_point',
  'relationship_signal',
  'personality_signal',
  'event',
  'plan',
  'inside_joke',
  'callback_candidate',
  'foreshadowing_candidate',
  'funny',
  'dramatic',
  'memorable',
  'recurring_language',
];

function parseDateString(dateStr, timeStr) {
  const dateParts = dateStr.trim().split(/[\/\.\-]/).map(part => parseInt(part, 10));
  if (dateParts.length < 3) return null;
  let [day, month, year] = dateParts;
  if (year < 100) year += 2000;
  if (month > 12 && day <= 12) [day, month] = [month, day];

  const cleanTime = timeStr.trim();
  const isPM = /pm/i.test(cleanTime);
  const isAM = /am/i.test(cleanTime);
  const timeNumbers = cleanTime.replace(/[^\d:]/g, '').split(':').map(part => parseInt(part, 10));
  let hours = timeNumbers[0] || 0;
  const minutes = timeNumbers[1] || 0;
  const seconds = timeNumbers[2] || 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  const parsed = new Date(year, month - 1, day, hours, minutes, seconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseWhatsAppExport(rawText) {
  const normalizedText = rawText.replace(/[\u202f\u00a0]/g, ' ');
  const lines = normalizedText.split(/\r?\n/);
  const messages = [];
  let currentMessage = null;
  let messageCounter = 0;

  for (const line of lines) {
    let matchHeader = null;
    for (const pattern of HEADER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        matchHeader = { dateStr: match[1], timeStr: match[2], bodyStr: match[3] };
        break;
      }
    }

    if (matchHeader) {
      if (currentMessage) messages.push(currentMessage);

      const timestamp = parseDateString(matchHeader.dateStr, matchHeader.timeStr) || new Date();
      const body = matchHeader.bodyStr.trim();
      const colonIndex = body.indexOf(': ');
      let sender = null;
      let text = body;
      if (colonIndex > 0) {
        sender = body.substring(0, colonIndex).trim();
        text = body.substring(colonIndex + 2).trim();
      }

      let type = 'message';
      const isMedia = MEDIA_PATTERNS.some(pattern => pattern.test(text) || pattern.test(body));
      const isSystem = !sender || SYSTEM_PATTERNS.some(pattern => pattern.test(body) || pattern.test(text));
      if (isMedia) type = 'media';
      else if (isSystem) {
        type = 'system';
        sender = null;
      }

      messageCounter++;
      currentMessage = {
        id: `msg_${messageCounter}`,
        timestamp: timestamp.toISOString(),
        sender,
        text,
        type,
      };
    } else if (currentMessage && line.trim().length > 0) {
      currentMessage.text += `\n${line}`;
    }
  }

  if (currentMessage) messages.push(currentMessage);
  return messages;
}

function countTypes(evidence) {
  const counts = Object.fromEntries(EVIDENCE_TYPES.map(type => [type, 0]));
  for (const item of evidence) {
    if (Object.hasOwn(counts, item.type)) counts[item.type]++;
  }
  return counts;
}

const fixturePath = process.env.CHAT_FIXTURE || 'client/src/lib/fixtures/sample_whatsapp_chat.txt';
const rawText = fs.readFileSync(path.resolve(fixturePath), 'utf8');
const messages = parseWhatsAppExport(rawText);
const chunks = createChunks([], messages);
const chunk = chunks[0];

if (!chunk) {
  throw new Error(`No chunk_1 created from ${fixturePath}`);
}

resetTokenTelemetry();
const provider = new GroqProvider();
const result = await extractSingleChunkWithRecovery(chunk, 0, chunks.length, provider);

if (!result.ok) {
  throw new Error(`chunk_1 extraction failed: ${result.error || 'unknown error'}`);
}

const evidence = result.extraction.evidence || [];
const counts = countTypes(evidence);
const telemetry = getTokenTelemetry();
const validation = result.validation || {
  rawEvidenceItems: evidence.length,
  validEvidenceItems: evidence.length,
  rejectedEvidenceItems: 0,
};

console.log('================ EVIDENCE TEST ================');
console.log('');
console.log(`Chunk: ${chunk.id}`);
console.log('');
console.log(`Messages analyzed: ${chunk.messages.filter(m => m.type === 'message').length}`);
console.log('');
console.log(`Raw evidence items: ${validation.rawEvidenceItems}`);
console.log(`Valid evidence items: ${validation.validEvidenceItems}`);
console.log(`Rejected evidence items: ${validation.rejectedEvidenceItems}`);
console.log('');
console.log(`Verified receipts: ${evidence.length}`);
console.log('');
console.log(`Affection: ${counts.affection}`);
console.log(`Love: ${counts.love}`);
console.log(`Flirting: ${counts.flirting}`);
console.log(`Rejection: ${counts.rejection}`);
console.log(`Conflict: ${counts.conflict}`);
console.log(`Apology: ${counts.apology}`);
console.log(`Vulnerability: ${counts.vulnerability}`);
console.log(`Promise: ${counts.promise}`);
console.log(`Contradictions: ${counts.contradiction}`);
console.log(`Behavior: ${counts.behavior}`);
console.log(`Turning points: ${counts.turning_point}`);
console.log(`Relationship signals: ${counts.relationship_signal}`);
console.log(`Personality signals: ${counts.personality_signal}`);
console.log(`Events: ${counts.event}`);
console.log(`Plans: ${counts.plan}`);
console.log(`Inside jokes: ${counts.inside_joke}`);
console.log(`Callbacks: ${counts.callback_candidate}`);
console.log(`Foreshadowing: ${counts.foreshadowing_candidate}`);
console.log(`Funny: ${counts.funny}`);
console.log(`Dramatic: ${counts.dramatic}`);
console.log(`Memorable: ${counts.memorable}`);
console.log(`Recurring language: ${counts.recurring_language}`);
console.log('');
console.log('===============================================');
console.log('');
console.log('[Telemetry]');
console.log(JSON.stringify(telemetry, null, 2));
console.log('');
console.log('[Validation]');
console.log(JSON.stringify(validation, null, 2));
console.log('');
console.log('[Final Valid Evidence JSON]');
console.log(JSON.stringify(result.extraction, null, 2));
