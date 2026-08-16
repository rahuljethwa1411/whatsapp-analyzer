import { useState, useEffect } from 'react';
import { FadeReveal } from '../components/afterchat/FadeReveal';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { AnalysisSequence } from '../components/afterchat/AnalysisSequence';
import { WhatsAppExportGuide } from '../components/afterchat/WhatsAppExportGuide';
import { useAnalysisSequence } from '../hooks/useAnalysisSequence';
import { useChatAnalysis } from '../context/ChatAnalysisContext';

const sampleTxtFixture = `12/08/24, 10:42 pm - Rahul: bro we're actually going Goa this time
12/08/24, 10:43 pm - Aisha: 100%
12/08/24, 10:45 pm - Kabir: booking tomorrow
12/08/24, 10:46 pm - Rahul: bro I wanted to tell you
something really important but I forgot
12/08/24, 11:15 pm - Nikhil: <Media omitted>
13/08/24, 01:17 am - Rahul: 💀 loooool
13/08/24, 01:18 am - Aisha: are you okay?
15/08/24, 09:30 am - Rahul: im on my way
15/08/24, 10:00 am - System: Rahul created group "Goa 2024"
15/08/24, 11:00 am - Kabir: dramatic re-entry 🤡`;

const typesWithEmoji = [
  { label: 'Partner / crush', emoji: '💖' },
  { label: 'Friend group', emoji: '🍻' },
  { label: 'Best friend', emoji: '⚡' },
  { label: 'Family', emoji: '🏡' },
  { label: 'Work / team', emoji: '💼' },
  { label: 'Other', emoji: '🌟' },
];

export function UploadPage() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [backstory, setBackstory] = useState('');
  const analysis = useAnalysisSequence();
  const { analysis: calculatedAnalysis, error: parseError, processRawText } = useChatAnalysis();

  // Check if ?demo=true was passed in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('demo') === 'true') {
      setSelected('Friend group');
      processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
      setStep(2);
    }
  }, []);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        processRawText(text, selectedFile.name);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleQuickDemo = () => {
    const chatCat = selected || 'Friend group';
    setSelected(chatCat);
    processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
    analysis.beginAnalysis(chatCat, backstory);
  };

  const handleStartAnalysis = () => {
    const chatCat = selected || 'Friend group';
    if (file && !calculatedAnalysis) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        processRawText(text, file.name);
        analysis.beginAnalysis(chatCat, backstory);
      };
      reader.readAsText(file);
    } else {
      if (!calculatedAnalysis) {
        processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
      }
      analysis.beginAnalysis(chatCat, backstory);
    }
  };

  if (analysis.isAnalysing) return (
    <AnalysisSequence
      ready={analysis.isReady}
      aiStatus={analysis.aiStatus}
      currentStage={analysis.currentStage}
      aiError={analysis.aiError}
    />
  );

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main className="upload">
        <div className="steps-header">
          <div className="steps">
            <span className={step >= 1 ? 'active' : ''}>01</span>
            <i />
            <span className={step >= 2 ? 'active' : ''}>02</span>
            <i />
            <span className={step >= 3 ? 'active' : ''}>03</span>
          </div>
          <button type="button" className="text-button quick-demo-badge" onClick={handleQuickDemo}>
            ⚡ Try Instant Sample Chat
          </button>
        </div>

        {parseError && (
          <div className="upload-error-banner">
            ⚠️ {parseError}
          </div>
        )}

        {step === 1 && (
          <FadeReveal>
            <p className="eyebrow">STEP 01 · THE CAST</p>
            <h1>
              Which chat are you
              <br />
              thinking of?
            </h1>
            <div className="choices">
              {typesWithEmoji.map((item) => (
                <button
                  onClick={() => {
                    setSelected(item.label);
                    window.setTimeout(() => setStep(2), 200);
                  }}
                  className={selected === item.label ? 'selected' : ''}
                  key={item.label}
                >
                  <span>
                    <i className="choice-emoji">{item.emoji}</i> {item.label}
                  </span>
                  <span className="arrow">→</span>
                </button>
              ))}
            </div>
          </FadeReveal>
        )}

        {step === 2 && (
          <FadeReveal>
            <p className="eyebrow">STEP 02 · THE ARCHIVE</p>
            <h1>Drop your chat here.</h1>
            <p className="lede">
              Export your WhatsApp conversation without media and upload the .txt file.
            </p>
            <div className="upload-archive-layout">
              <div>
                <label
                  className={
                    'drop ' +
                    (file || calculatedAnalysis ? 'hasfile ' : '') +
                    (isDragging ? 'is-dragging' : '')
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                  />
                  {file || calculatedAnalysis ? (
                    <>
                      <b>Chat imported ✓</b>
                      <p>
                        {calculatedAnalysis
                          ? `${calculatedAnalysis.metadata.totalMessages.toLocaleString()} messages parsed (${calculatedAnalysis.metadata.totalParticipants} participants)`
                          : '24,821 messages · 4 people'}
                      </p>
                      <small>{file?.name || 'sample_whatsapp_chat.txt'} ({file ? (file.size / 1024).toFixed(1) : '14.2'} KB)</small>
                    </>
                  ) : (
                    <>
                      <b>
                        Choose a .txt file <span>↓</span>
                      </b>
                      <p>or drag & drop your exported chat here</p>
                    </>
                  )}
                </label>
                <div className="upload-btn-row">
                  {(file || calculatedAnalysis) && (
                    <button className="button" onClick={() => setStep(3)}>
                      Continue <span>→</span>
                    </button>
                  )}
                  <button type="button" className="text-button" onClick={handleQuickDemo}>
                    Use sample chat instead
                  </button>
                </div>
              </div>
              <WhatsAppExportGuide />
            </div>
          </FadeReveal>
        )}

        {step === 3 && (
          <FadeReveal>
            <p className="eyebrow">STEP 03 · BACKSTORY (OPTIONAL)</p>
            <h1>Give us the lore.</h1>
            <p className="lede">
              A little context can make the story better. It is background, not evidence.
            </p>
            <textarea
              placeholder="Anything we should know before we dig in?"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
            />
            <p className="example">
              Example: This is my college friend group. We've known each other since 2022. The Goa
              trip mentioned in the chat never happened.
            </p>
            <div className="actions">
              <button className="text-button" onClick={handleStartAnalysis}>
                Skip
              </button>
              <button className="button" onClick={handleStartAnalysis}>
                Continue <span>→</span>
              </button>
            </div>
          </FadeReveal>
        )}
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}


