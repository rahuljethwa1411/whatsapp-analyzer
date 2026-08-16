import { ParserResult } from './types';

export function validateParserResult(result: ParserResult): { valid: boolean; error: string | null } {
  if (result.totalRawLines === 0) {
    return { valid: false, error: 'The uploaded file is empty.' };
  }

  if (result.parsedHeaderCount === 0 || result.messages.length === 0) {
    return {
      valid: false,
      error: 'We couldn\'t read this chat export. Make sure you\'re uploading a valid WhatsApp .txt export without media.',
    };
  }

  const normalMessages = result.messages.filter((m) => m.type === 'message');
  if (normalMessages.length === 0 && result.messages.length > 0) {
    return {
      valid: true,
      error: null, // Valid chat, though only contains system/media messages
    };
  }

  return { valid: true, error: null };
}
