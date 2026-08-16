import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ChatAnalysisProvider } from './context/ChatAnalysisContext';
import { IntelligenceProvider } from './context/IntelligenceContext';
import { StoryProvider } from './context/StoryContext';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <ChatAnalysisProvider>
    <IntelligenceProvider>
      <StoryProvider>
        <App />
      </StoryProvider>
    </IntelligenceProvider>
  </ChatAnalysisProvider>
);

