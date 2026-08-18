/**
 * Narrative & PDF Text Formatter
 * Cleans raw message IDs, normalizes Unicode symbols, and sanitizes strings for jsPDF.
 */

/**
 * Strips raw internal message ID tokens (e.g. [msg_123], (msg_123), msg_123) from prose.
 */
export function cleanNarrative(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Replace "[msg_123]" or "(msg_123)" or "msg_123" or "ev_int_1"
    .replace(/\[\s*msg_\d+\s*\]/gi, '')
    .replace(/\(\s*msg_\d+\s*\)/gi, '')
    .replace(/\bmsg_\d+\b/gi, '')
    .replace(/\[\s*ev_int_\d+\s*\]/gi, '')
    .replace(/\(\s*ev_int_\d+\s*\)/gi, '')
    .replace(/\bev_int_\d+\b/gi, '')
    .replace(/\bKey stats:\s*(-[^\n]*\n*)+/gi, '')
    // Clean multiple spaces and dangling punctuation
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?:;])/g, '$1')
    .trim();
}

/**
 * Strips or converts Unicode emojis and non-Latin-1 characters to safe ASCII
 * so jsPDF built-in fonts (Helvetica, Courier, Times) never produce broken mojibake (e.g. Ø=Ü«, Ø=Ý).
 */
export function sanitizePdfString(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = cleanNarrative(text);

  // Common Unicode punctuation replacements
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'") // single curly quotes
    .replace(/[\u201C\u201D]/g, '"') // double curly quotes
    .replace(/[\u2013\u2014]/g, '-') // en-dash, em-dash
    .replace(/\u2026/g, '...')       // ellipsis
    .replace(/\u2022/g, '*')         // bullet
    .replace(/[\u2190-\u2199]/g, '->') // arrows
    .replace(/\u00A0/g, ' ');        // non-breaking space

  // Common emoji conversions to readable text or clean removal
  cleaned = cleaned
    .replace(/🔒/g, '[CONFIDENTIAL]')
    .replace(/💀/g, '[SKULL]')
    .replace(/🏆/g, '[AWARD]')
    .replace(/⭐|🌟|✨/g, '*')
    .replace(/❤️|💖|💕/g, '<3')
    .replace(/🔥/g, '[FIRE]')
    .replace(/😂|🤣/g, '[LOL]')
    .replace(/👀/g, '[EYES]')
    .replace(/🤡/g, '[CLOWN]')
    .replace(/🍻/g, '[CHEERS]')
    .replace(/💼/g, '[WORK]')
    .replace(/🏡/g, '[HOME]')
    .replace(/⚡/g, '[ZAP]');

  // Remove any remaining emoji / surrogate pair ranges
  cleaned = cleaned.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');

  // Remove non-ASCII characters outside standard printable Latin range
  cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Cleans participant name for safe display in PDF titles and header blocks
 */
export function cleanParticipantName(name: string): string {
  if (!name) return 'Participant';
  return sanitizePdfString(name).replace(/[^a-zA-Z0-9\s._-]/g, '').trim() || name;
}
