import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { ChatAnalysis } from '../types/analysis';
import { ChatMessage } from '../types/chat';
import { parseWhatsAppExport } from '../lib/whatsapp/parser';
import { validateParserResult } from '../lib/whatsapp/validators';
import { analyzeChat } from '../lib/analysis';

interface ChatAnalysisContextType {
  analysis: ChatAnalysis | null;
  messages: ChatMessage[];  // raw parsed messages (in-memory only, not persisted)
  rawFileName: string | null;
  error: string | null;
  isUsingMock: boolean;
  processRawText: (rawText: string, fileName?: string) => { success: boolean; error: string | null };
  resetAnalysis: () => void;
}

const ChatAnalysisContext = createContext<ChatAnalysisContextType | undefined>(undefined);

function hydrateDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key in obj) {
    if (typeof obj[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj[key])) {
      obj[key] = new Date(obj[key]);
    } else if (typeof obj[key] === 'object') {
      hydrateDates(obj[key]);
    }
  }
  return obj;
}

const defaultSampleFixture = `12/08/24, 10:42 pm - Alex: bro we're actually going Goa this time
12/08/24, 10:43 pm - Sam: 100%
12/08/24, 10:45 pm - Kabir: booking tomorrow
12/08/24, 10:46 pm - Alex: bro I wanted to tell you
something really important but I forgot
12/08/24, 11:15 pm - Nikhil: <Media omitted>
13/08/24, 01:17 am - Alex: 💀 loooool
13/08/24, 01:18 am - Sam: are you okay?
15/08/24, 09:30 am - Alex: im on my way
15/08/24, 10:00 am - System: Alex created group "Goa 2024"
15/08/24, 11:00 am - Kabir: dramatic re-entry 🤡`;

function getDefaultSampleAnalysis(): { analysis: ChatAnalysis; messages: ChatMessage[] } {
  const parsed = parseWhatsAppExport(defaultSampleFixture);
  return { analysis: analyzeChat(parsed.messages), messages: parsed.messages };
}

export function ChatAnalysisProvider({ children }: { children: ReactNode }) {
  const defaultSample = getDefaultSampleAnalysis();

  const [analysis, setAnalysis] = useState<ChatAnalysis>(() => {
    try {
      const saved = localStorage.getItem('afterchat_analysis');
      if (saved) return hydrateDates(JSON.parse(saved));
    } catch { /* ignore */ }
    return defaultSample.analysis;
  });

  // Messages are kept only in memory (not localStorage — can be large)
  const [messages, setMessages] = useState<ChatMessage[]>(defaultSample.messages);

  const [rawFileName, setRawFileName] = useState<string | null>(() =>
    localStorage.getItem('afterchat_filename') || 'sample_chat_export.txt'
  );

  const [error, setError] = useState<string | null>(null);
  const [isUsingMock, setIsUsingMock] = useState(() => !localStorage.getItem('afterchat_analysis'));

  const processRawText = (rawText: string, fileName: string = 'chat_export.txt') => {
    setError(null);

    try {
      const parserResult = parseWhatsAppExport(rawText);
      const validation = validateParserResult(parserResult);

      if (!validation.valid) {
        setError(validation.error);
        return { success: false, error: validation.error };
      }

      const calculatedAnalysis = analyzeChat(parserResult.messages);
      setAnalysis(calculatedAnalysis);
      setMessages(parserResult.messages);  // keep messages in memory
      setRawFileName(fileName);
      setIsUsingMock(false);

      try {
        localStorage.setItem('afterchat_analysis', JSON.stringify(calculatedAnalysis));
        localStorage.setItem('afterchat_filename', fileName);
        localStorage.removeItem('afterchat_intelligence');
        localStorage.removeItem('afterchat_story');
        localStorage.removeItem('afterchat_access_mode');
        sessionStorage.removeItem('afterchat_payment_verified');
      } catch { /* storage full */ }

      return { success: true, error: null };
    } catch {
      const errMsg = "We couldn't parse this chat file. Please ensure it's a valid WhatsApp text export.";
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const resetAnalysis = () => {
    const fresh = getDefaultSampleAnalysis();
    setAnalysis(fresh.analysis);
    setMessages(fresh.messages);
    setRawFileName('sample_chat_export.txt');
    setError(null);
    setIsUsingMock(true);
    try {
      localStorage.removeItem('afterchat_analysis');
      localStorage.removeItem('afterchat_filename');
      localStorage.removeItem('afterchat_intelligence');
      localStorage.removeItem('afterchat_story');
      localStorage.removeItem('afterchat_access_mode');
      sessionStorage.removeItem('afterchat_payment_verified');
    } catch { /* ignore */ }
  };

  return (
    <ChatAnalysisContext.Provider value={{ analysis, messages, rawFileName, error, isUsingMock, processRawText, resetAnalysis }}>
      {children}
    </ChatAnalysisContext.Provider>
  );
}

export function useChatAnalysis() {
  const context = useContext(ChatAnalysisContext);
  if (!context) throw new Error('useChatAnalysis must be used within a ChatAnalysisProvider');
  return context;
}
