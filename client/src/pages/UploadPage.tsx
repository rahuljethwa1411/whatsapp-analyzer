import { useState, useEffect } from 'react';
import { FadeReveal } from '../components/afterchat/FadeReveal';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { AnalysisSequence } from '../components/afterchat/AnalysisSequence';
import { WhatsAppExportGuide } from '../components/afterchat/WhatsAppExportGuide';
import { useAnalysisSequence } from '../hooks/useAnalysisSequence';
import { useChatAnalysis } from '../context/ChatAnalysisContext';
import { extractChatFile } from '../lib/zipExtractor';

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
  const {
    analysis: calculatedAnalysis,
    error: parseError,
    processRawText,
    isUsingMock,
    rawFileName,
    resetAnalysis,
  } = useChatAnalysis();

  const hasImportedFile = Boolean(file || (calculatedAnalysis && !isUsingMock));

  const handleResetFile = () => {
    setFile(null);
    resetAnalysis();
  };

  // Check if ?demo=true was passed in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('demo') === 'true') {
      setSelected('Friend group');
      processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
      setStep(2);
    }
  }, []);

  const handleFileChange = async (selectedFile: File | null) => {
    setFile(selectedFile);
    if (selectedFile) {
      try {
        const { text, fileName } = await extractChatFile(selectedFile);
        processRawText(text, fileName || selectedFile.name);
      } catch (err: any) {
        console.error('Failed to parse file archive:', err);
      }
    }
  };

  const handleQuickDemo = () => {
    const chatCat = selected || 'Friend group';
    setSelected(chatCat);
    processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
    analysis.beginAnalysis(chatCat, backstory);
  };

  const handleStartAnalysis = async () => {
    const chatCat = selected || 'Friend group';
    if (file) {
      try {
        const { text, fileName } = await extractChatFile(file);
        const res = processRawText(text, fileName || file.name);
        if (res.success) {
          await analysis.beginAnalysis(chatCat, backstory);
        }
      } catch (err: any) {
        console.error('Failed to process upload file:', err);
      }
    } else {
      if (!calculatedAnalysis || isUsingMock) {
        processRawText(sampleTxtFixture, 'sample_whatsapp_chat.txt');
      }
      await analysis.beginAnalysis(chatCat, backstory);
    }
  };

  if (analysis.isAnalysing) return (
    <AnalysisSequence
      ready={analysis.isReady}
      aiStatus={analysis.aiStatus}
      currentStage={analysis.currentStage}
      progress={analysis.progress}
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
            <h1>{hasImportedFile ? 'Chat Ready to Analyze' : 'Drop your chat here.'}</h1>
            <p className="lede">
              {hasImportedFile
                ? 'Your WhatsApp export has been loaded into memory. You can continue or upload a different chat file.'
                : 'Export your WhatsApp conversation and upload the .txt or .zip file archive.'}
            </p>
            <div className="upload-archive-layout">
              <div>
                <label
                  className={
                    'drop ' +
                    (hasImportedFile ? 'hasfile ' : '') +
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
                    accept=".txt,.zip,application/zip,application/x-zip-compressed"
                    onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                  />
                  {hasImportedFile ? (
                    <>
                      <b>Chat imported ✓</b>
                      <p>
                        {calculatedAnalysis
                          ? `${calculatedAnalysis.metadata.totalMessages.toLocaleString()} messages parsed (${calculatedAnalysis.metadata.totalParticipants} participants)`
                          : 'Chat data ready'}
                      </p>
                      <small>
                        {file?.name || rawFileName || 'chat_export.txt'}{' '}
                        {file ? `(${(file.size / 1024).toFixed(1)} KB)` : ''}
                      </small>
                    </>
                  ) : (
                    <>
                      <b>
                        Choose a .txt or .zip file <span>↓</span>
                      </b>
                      <p>or drag & drop your WhatsApp export (.txt or .zip) here</p>
                    </>
                  )}
                </label>
                <div className="upload-btn-row" style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
                  {hasImportedFile ? (
                    <>
                      <button className="button" onClick={() => setStep(3)}>
                        Continue <span>→</span>
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        style={{ opacity: 0.8 }}
                        onClick={handleResetFile}
                      >
                        Upload a new chat ↻
                      </button>
                    </>
                  ) : null}
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
              Example: This is my college friend group. We've known each other since 2022. We talk a lot about football and weekend plans.
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


