import { ChatMessage } from '../../types/chat';

export type ParserOptions = {
  defaultYear?: number;
  strictHeaderCheck?: boolean;
};

export type ParserResult = {
  messages: ChatMessage[];
  totalRawLines: number;
  parsedHeaderCount: number;
  errors: string[];
};
