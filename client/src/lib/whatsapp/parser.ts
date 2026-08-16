import { ChatMessage, MessageType } from '../../types/chat';
import { HEADER_PATTERNS, MEDIA_PATTERNS, SYSTEM_PATTERNS, parseDateString } from './formats';
import { ParserOptions, ParserResult } from './types';

export function parseWhatsAppExport(rawText: string, options: ParserOptions = {}): ParserResult {
  const normalizedText = rawText.replace(/[\u202f\u00a0]/g, ' ');
  const lines = normalizedText.split(/\r?\n/);
  const messages: ChatMessage[] = [];
  const errors: string[] = [];

  let currentMessage: ChatMessage | null = null;
  let parsedHeaderCount = 0;
  let messageCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line starts a new message header
    let matchHeader: { dateStr: string; timeStr: string; bodyStr: string } | null = null;

    for (const pattern of HEADER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        matchHeader = {
          dateStr: match[1],
          timeStr: match[2],
          bodyStr: match[3],
        };
        break;
      }
    }

    if (matchHeader) {
      parsedHeaderCount++;

      // Finalize previous message
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const timestamp = parseDateString(matchHeader.dateStr, matchHeader.timeStr) || new Date();
      const body = matchHeader.bodyStr.trim();

      // Split Sender vs Message
      // Pattern: "Sender Name: Message text"
      let sender: string | null = null;
      let text = body;
      const colonIndex = body.indexOf(': ');

      if (colonIndex > 0) {
        sender = body.substring(0, colonIndex).trim();
        text = body.substring(colonIndex + 2).trim();
      }

      // Determine MessageType (media, system, or message)
      let type: MessageType = 'message';

      const isMedia = MEDIA_PATTERNS.some((p) => p.test(text) || p.test(body));
      const isSystem = !sender || SYSTEM_PATTERNS.some((p) => p.test(body) || p.test(text));

      if (isMedia) {
        type = 'media';
      } else if (isSystem) {
        type = 'system';
        sender = null; // System messages have no specific sender
      }

      messageCounter++;
      currentMessage = {
        id: `msg_${messageCounter}`,
        timestamp,
        sender,
        text,
        type,
        rawHeader: `${matchHeader.dateStr}, ${matchHeader.timeStr}`,
      };
    } else if (currentMessage) {
      // Multiline message continuation!
      // Append non-header line to current message text
      if (line.trim().length > 0) {
        currentMessage.text += '\n' + line;
      }
    }
  }

  // Push last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return {
    messages,
    totalRawLines: lines.length,
    parsedHeaderCount,
    errors,
  };
}
