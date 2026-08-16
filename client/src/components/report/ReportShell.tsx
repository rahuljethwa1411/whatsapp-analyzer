/**
 * ReportShell Component
 * Master container for Phase 4 AfterChat report experience.
 */

import { useState, useEffect } from 'react';
import { Navbar } from '../afterchat/Navbar';
import { Footer } from '../afterchat/Footer';
import { ContactModal } from '../afterchat/ContactModal';
import { ShareModal } from '../afterchat/ShareModal';
import { ReportNavigation } from './ReportNavigation';
import { ReportHero } from './ReportHero';
import { ChatSnapshot } from './ChatSnapshot';
import { StorySection } from './StorySection';
import { EraSection } from './EraSection';
import { CharacterSection } from './CharacterSection';
import { PlotTwistSection } from './PlotTwistSection';
import { LoreSection } from './LoreSection';
import { AwardsSection } from './AwardsSection';
import { WrappedSection } from './WrappedSection';
import { FinalVerdict } from './FinalVerdict';
import { PreviewGate } from './PreviewGate';

import { useChatAnalysis } from '../../context/ChatAnalysisContext';
import { useIntelligence } from '../../context/IntelligenceContext';
import { useStory } from '../../context/StoryContext';

export function ReportShell() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { analysis } = useChatAnalysis();
  const { intelligence, getMessagesByIds } = useIntelligence();
  const { story, generateStory, accessMode, setAccessMode } = useStory();

  // Generate/update story whenever intelligence or analysis is loaded
  useEffect(() => {
    if (analysis) {
      generateStory(intelligence, analysis);
    }
  }, [intelligence, analysis, generateStory]);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isUnlocked = accessMode === 'full';

  const totalMsgsStr = analysis ? analysis.metadata.totalMessages.toLocaleString() : '24,821';
  const participantsStr = analysis
    ? analysis.metadata.participants.join(', ')
    : 'Rahul, Aisha, Kabir & Nikhil';
  const durationDays = analysis ? analysis.metadata.durationDays : 580;
  const overallTone = intelligence?.overview.overallTone || 'Chaotic Comfort';

  const unlockedCount = intelligence
    ? {
        eras: intelligence.eras.length,
        characters: intelligence.characters.length,
        lore: intelligence.lore.length,
        twists: intelligence.plotTwists.length,
      }
    : undefined;

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <ReportNavigation />

      <main className="report phase4-report">
        <div className="report-progress" style={{ width: `${scrollProgress}%` }} />

        {/* 01. HERO */}
        <ReportHero
          participantsStr={participantsStr}
          totalMessagesStr={totalMsgsStr}
          durationDays={durationDays}
          onShare={() => setIsShareOpen(true)}
          onUnlock={() => setAccessMode('full')}
          isUnlocked={isUnlocked}
        />

        {/* 02. SNAPSHOT */}
        <ChatSnapshot analysis={analysis} />

        {/* 03. COMPLETE STORY */}
        <StorySection
          story={story}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* 04. STORY ERAS */}
        <EraSection
          eras={intelligence?.eras || []}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* 05. CHARACTERS */}
        <CharacterSection
          characters={intelligence?.characters || []}
          participantStats={analysis?.participants || []}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* 06. PLOT TWISTS */}
        <PlotTwistSection
          twists={intelligence?.plotTwists || []}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* 07. LORE */}
        <LoreSection
          lore={intelligence?.lore || []}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* 08. AWARDS */}
        <AwardsSection
          awards={story?.awards || []}
          getMessagesByIds={getMessagesByIds}
          isUnlocked={isUnlocked}
        />

        {/* PREVIEW GATE BANNER (if in preview mode) */}
        {!isUnlocked && (
          <PreviewGate
            onUnlock={() => setAccessMode('full')}
            unlockedCount={unlockedCount}
          />
        )}

        {/* 09. WRAPPED */}
        <WrappedSection analysis={analysis} />

        {/* 10. FINAL VERDICT */}
        <FinalVerdict
          verdict={story?.verdict || null}
          overallTone={overallTone}
          totalMessagesStr={totalMsgsStr}
          durationDays={durationDays}
        />
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
    </>
  );
}
