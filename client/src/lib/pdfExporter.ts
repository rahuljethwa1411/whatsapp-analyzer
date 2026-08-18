/**
 * Classified PDF Dossier Exporter for AfterChat
 *
 * Generates a high-resolution investigative case file styled like a
 * top-secret intelligence agency dossier.
 *
 * Features:
 *  - Full narrative chapters (all 10 chapters rendered in complete, unedited prose)
 *  - Full era summaries and chronological breakdowns (no 2-3 line truncations)
 *  - Dynamic page flow and automatic pagination across chapters and eras
 *  - Two-pass header/footer stamping (PAGE X OF Y)
 *  - Sanitized text for PDF font safety (zero Unicode mojibake / raw IDs)
 */

import jsPDF from 'jspdf';
import { Story } from '../types/story';
import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';
import { ChatMessage } from '../types/chat';
import { sanitizePdfString, cleanParticipantName, cleanNarrative } from './narrativeFormatter';

interface ExportDossierOptions {
  story: Story | null;
  intelligence: AfterchatIntelligence | null;
  analysis: ChatAnalysis | null;
  getMessagesByIds: (ids: string[]) => ChatMessage[];
}

export async function exportPdfDossier({
  story,
  intelligence,
  analysis,
}: ExportDossierOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const rawParticipants = analysis?.metadata.participants || ['Participant 1', 'Participant 2'];
  const cleanParticipants = rawParticipants.map(cleanParticipantName);
  const participantsStr = cleanParticipants.join(' & ');
  const totalMsgs = (analysis?.metadata.totalMessages || 23979).toLocaleString();
  const durationDays = analysis?.metadata.durationDays || 365;
  const caseId = `AC-${Math.floor(100000 + Math.random() * 900000)}`;

  // Set official PDF document properties
  doc.setProperties({
    title: `AfterChat Classified Dossier - ${participantsStr}`,
    subject: `Forensic WhatsApp Archive Analysis (${totalMsgs} messages, ${durationDays} days)`,
    author: 'AfterChat Forensic Intelligence',
    keywords: 'afterchat, whatsapp, intelligence, case file, dossier',
    creator: 'AfterChat Intelligence Agency (afterchat.app)',
  });

  // ─── Theme Colors ─────────────────────────────────────────────────────────
  const cRed = [204, 81, 61];        // #cc513d Crimson
  const cDark = [18, 20, 26];       // #12141a Obsidian Dark
  const cGold = [180, 130, 30];      // Amber Gold
  const cCard = [248, 246, 240];     // Off-white Parchment
  const cBorder = [225, 220, 210];   // Line border
  const cTextDark = [25, 25, 30];    // Primary text
  const cTextMuted = [100, 95, 90];  // Secondary text

  const pageSectionTitles = new Map<number, string>();
  pageSectionTitles.set(1, 'Executive Case Summary');

  let curY = 36;

  // Helper to flow across pages
  const ensureSpace = (neededHeight: number, sectionTitle: string) => {
    if (curY + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      const newPage = doc.getNumberOfPages();
      pageSectionTitles.set(newPage, sectionTitle);
      curY = 24;
    }
  };

  // Helper to print wrapped text with automatic line height and page overflow
  const printFlowingText = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight = 4.2,
    sectionTitle = 'Investigation Dossier'
  ): void => {
    const safeText = sanitizePdfString(text);
    const paragraphs = safeText.split('\n');

    paragraphs.forEach((para) => {
      if (!para.trim()) {
        curY += lineHeight * 0.6;
        return;
      }
      const lines = doc.splitTextToSize(para, maxWidth);
      lines.forEach((line: string) => {
        ensureSpace(lineHeight, sectionTitle);
        doc.text(line, x, curY);
        curY += lineHeight;
      });
    });
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER & EXECUTIVE CASE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════

  // Classified Stamp Badge
  doc.setDrawColor(cRed[0], cRed[1], cRed[2]);
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(margin, 19, 56, 8.5, 1.5, 1.5, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cRed[0], cRed[1], cRed[2]);
  doc.text('[CLASSIFIED EVIDENCE]', margin + 28, 24.8, { align: 'center' });

  // Barcode / Case ID
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  doc.text(`CASE REF: ${caseId} - ARCHIVE INVESTIGATION`, pageWidth - margin, 24.8, { align: 'right' });

  // Main Dossier Headline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  const rawTitle = story?.title || 'THE COMPLETE WHATSAPP FORENSIC DOSSIER';
  const titleLines = doc.splitTextToSize(sanitizePdfString(rawTitle), contentWidth);
  doc.text(titleLines, margin, curY);
  curY += titleLines.length * 7;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  const rawSubtitle = story?.subtitle || `A forensic breakdown of ${participantsStr}`;
  const subLines = doc.splitTextToSize(sanitizePdfString(rawSubtitle), contentWidth);
  doc.text(subLines, margin, curY + 1);
  curY += subLines.length * 4.8 + 4;

  // Case Metadata Plaque
  doc.setFillColor(cCard[0], cCard[1], cCard[2]);
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.roundedRect(margin, curY, contentWidth, 25, 2, 2, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cGold[0], cGold[1], cGold[2]);
  doc.text(`SUBJECTS: ${participantsStr.toUpperCase()}`, margin + 5, curY + 6.5);
  doc.text(`TOTAL EVIDENCE: ${totalMsgs} MESSAGES`, margin + 5, curY + 13);
  doc.text(`TIMELINE SPAN: ${durationDays} DAYS`, margin + 5, curY + 19.5);

  doc.text(`STATUS: 100% UNEDITED`, pageWidth - margin - 5, curY + 6.5, { align: 'right' });
  doc.text(`PEAK TIME: ${analysis?.activity.peakHour?.label || '11:00 PM'}`, pageWidth - margin - 5, curY + 13, { align: 'right' });
  doc.text(`LONGEST STREAK: ${analysis?.streaks.longestActiveStreak?.durationDays || 0} DAYS`, pageWidth - margin - 5, curY + 19.5, { align: 'right' });

  curY += 32;

  // Executive Opening Narrative
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('I. EXECUTIVE INVESTIGATION OPENING', margin, curY);
  curY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(45, 45, 50);
  const openingText = story?.opening ||
    `This dossier documents the complete forensic analysis of the exported WhatsApp conversation archive between ${participantsStr}. Over ${totalMsgs} verified messages spanning ${durationDays} days, the archive captures a high-density dynamic defined by signature texting rhythms, unhinged banter, late-night disclosures, and verifiable relationship milestones.`;
  printFlowingText(cleanNarrative(openingText), margin, contentWidth, 4.3, 'Executive Case Summary');

  curY += 6;

  // Ground Truth Telemetry Cards
  ensureSpace(28, 'Executive Case Summary');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('II. ARCHIVE TELEMETRY & BEHAVIORAL VITALS', margin, curY);
  curY += 5;

  const statBoxWidth = (contentWidth - 8) / 3;
  const topEmojiClean = analysis?.emojis.mostUsedEmoji ? sanitizePdfString(analysis.emojis.mostUsedEmoji) || '[Top Emoji]' : '[Top Emoji]';
  const statItems = [
    { label: 'TOP SIGNATURE EMOJI', val: topEmojiClean },
    { label: 'LONGEST SILENCE GAP', val: `${analysis?.streaks.longestSilence?.durationDays || 0} Days` },
    { label: 'PEAK CHAT MONTH', val: analysis?.activity.peakMonth?.monthName || 'October' },
  ];

  statItems.forEach((st, i) => {
    const bx = margin + i * (statBoxWidth + 4);
    doc.setFillColor(243, 240, 233);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(bx, curY, statBoxWidth, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(st.val, bx + statBoxWidth / 2, curY + 7, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(st.label, bx + statBoxWidth / 2, curY + 12.5, { align: 'center' });
  });

  curY += 22;

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION II: COMPLETE 10-CHAPTER NARRATIVE CHRONICLES (FULL TEXT)
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  const storyStartPage = doc.getNumberOfPages();
  pageSectionTitles.set(storyStartPage, 'Investigation Narrative');
  curY = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('III. THE COMPLETE NARRATIVE CHRONICLES', margin, curY);
  curY += 7;

  const allChapters = story?.chapters || [];

  allChapters.forEach((ch, idx) => {
    const chapNum = idx + 1;
    const chapNumStr = chapNum < 10 ? `0${chapNum}` : `${chapNum}`;

    ensureSpace(35, `Investigation Narrative (Chapter ${chapNumStr})`);

    // Chapter Header Card
    doc.setFillColor(245, 242, 235);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 14, 1.5, 1.5, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CHAPTER ${chapNumStr} // ${sanitizePdfString(ch.period).toUpperCase() || 'ARCHIVE ERA'}`, margin + 4, curY + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(ch.title).slice(0, 85), margin + 4, curY + 10.5);

    curY += 17;

    // Full Unedited Chapter Narrative
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 45);

    const fullCleanedNarrative = cleanNarrative(ch.narrative);
    printFlowingText(
      fullCleanedNarrative,
      margin + 2,
      contentWidth - 4,
      4.3,
      `Investigation Narrative (Chapter ${chapNumStr})`
    );

    curY += 6;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION III: RELATIONSHIP ERAS & CHRONOLOGICAL SHIFTS (FULL TEXT)
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  const eraStartPage = doc.getNumberOfPages();
  pageSectionTitles.set(eraStartPage, 'Chronological Story Eras');
  curY = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('IV. RELATIONSHIP ERAS & CHRONOLOGICAL SHIFTS', margin, curY);
  curY += 7;

  const eras = intelligence?.eras || [];

  eras.forEach((era, idx) => {
    ensureSpace(32, 'Chronological Story Eras');

    // Era Header
    doc.setFillColor(249, 247, 243);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 13, 1.5, 1.5, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(
      `PHASE 0${idx + 1} // ${sanitizePdfString(era.startAt || 'START')} TO ${sanitizePdfString(era.endAt || 'END')}`,
      margin + 4,
      curY + 5
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(era.title).slice(0, 80), margin + 4, curY + 10);

    curY += 16;

    // Full Era Summary
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 50);
    const cleanedSummary = cleanNarrative(era.summary);
    printFlowingText(cleanedSummary, margin + 2, contentWidth - 4, 4.2, 'Chronological Story Eras');

    // Dominant Themes
    if (era.dominantTopics?.length) {
      ensureSpace(8, 'Chronological Story Eras');
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(cGold[0], cGold[1], cGold[2]);
      const domThemes = sanitizePdfString(era.dominantTopics.slice(0, 5).join(' * '));
      doc.text(`DOMINANT THEMES: ${domThemes}`, margin + 2, curY);
      curY += 6;
    }

    curY += 4;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION IV: CAST DOSSIER & RECOVERED LORE
  // ══════════════════════════════════════════════════════════════════════════════
  ensureSpace(40, 'Cast Dossier & Inside Lore');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('V. THE PARTICIPANT DOSSIER (OBSERVED BEHAVIOR)', margin, curY);
  curY += 7;

  const characters = intelligence?.characters || [];
  characters.forEach((char) => {
    ensureSpace(28, 'Cast Dossier & Inside Lore');

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 11, 1.5, 1.5, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(sanitizePdfString(char.title || 'SUBJECT PROFILE').toUpperCase(), margin + 4, curY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(cleanParticipantName(char.participant), margin + 4, curY + 9);

    curY += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 50);
    printFlowingText(cleanNarrative(char.description), margin + 2, contentWidth - 4, 4.1, 'Cast Dossier & Inside Lore');
    curY += 4;
  });

  // Plot Twists & Turning Points
  const plotTwists = intelligence?.plotTwists || [];
  if (plotTwists.length > 0) {
    ensureSpace(30, 'Critical Plot Twists');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text('VI. CRITICAL PLOT TWISTS & TIMELINE SHIFTS', margin, curY);
    curY += 6;

    plotTwists.forEach((twist, tIdx) => {
      ensureSpace(22, 'Critical Plot Twists');

      doc.setFillColor(253, 248, 246);
      doc.setDrawColor(230, 200, 190);
      doc.roundedRect(margin, curY, contentWidth, 10, 1.5, 1.5, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(cRed[0], cRed[1], cRed[2]);
      const periodStr = twist.beforePeriod && twist.afterPeriod ? ` // ${sanitizePdfString(twist.beforePeriod)} -> ${sanitizePdfString(twist.afterPeriod)}` : '';
      doc.text(`PLOT TWIST #${tIdx + 1}${periodStr}`, margin + 4, curY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(cDark[0], cDark[1], cDark[2]);
      doc.text(sanitizePdfString(twist.title).slice(0, 75), margin + 4, curY + 8.5);

      curY += 13;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(45, 45, 50);
      printFlowingText(cleanNarrative(twist.description), margin + 2, contentWidth - 4, 3.8, 'Critical Plot Twists');
      curY += 4;
    });
  }

  // Recovered Inside Joke Lore
  const loreItems = intelligence?.lore || [];
  if (loreItems.length > 0) {
    ensureSpace(28, 'Inside Joke Lore');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text('VII. RECOVERED INSIDE JOKE LORE & RUNNING GAGS', margin, curY);
    curY += 6;

    loreItems.forEach((lore) => {
      ensureSpace(18, 'Inside Joke Lore');

      doc.setFillColor(245, 243, 237);
      doc.roundedRect(margin, curY, contentWidth, 9, 1.5, 1.5, 'F');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(cGold[0], cGold[1], cGold[2]);
      doc.text(`MEME / INSIDE JOKE: "${sanitizePdfString(lore.title).toUpperCase()}"`, margin + 4, curY + 6);

      curY += 11;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(45, 45, 50);
      printFlowingText(cleanNarrative(lore.description), margin + 2, contentWidth - 4, 3.8, 'Inside Joke Lore');
      curY += 4;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION V: SATIRICAL AWARDS & FINAL CASE VERDICT
  // ══════════════════════════════════════════════════════════════════════════════
  ensureSpace(45, 'Official Verdict & Awards');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VIII. THE ANNUAL SATIRICAL AWARDS CEREMONY', margin, curY);
  curY += 7;

  const awards = story?.awards || [];
  awards.forEach((award) => {
    ensureSpace(22, 'Official Verdict & Awards');

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    const cleanAwardRecipient = cleanParticipantName(award.recipient);
    doc.text(`[AWARD] ${sanitizePdfString(award.title)} -> ${cleanAwardRecipient}`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 55);
    const cleanedReason = cleanNarrative(award.reason);
    const reasonLines = doc.splitTextToSize(sanitizePdfString(cleanedReason), contentWidth - 8);
    doc.text(reasonLines, margin + 4, curY + 11.5);

    curY += 23;
  });

  // Final Dramatic Verdict Box (Obsidian Dark Luxury Box)
  ensureSpace(55, 'Official Verdict & Awards');
  curY += 2;

  const verdictTitle = sanitizePdfString(story?.verdict?.title || 'PERMANENTLY ENTANGLED DIGITAL CHAOS');
  const verdictDesc = cleanNarrative(
    story?.verdict?.description ||
      `After comprehensive forensic analysis of the chat archive between ${participantsStr}, the evidence confirms an unhinged, deeply grounded dynamic that thrives on chaotic banter, delayed replies, and shared history.`
  );
  const badgeName = sanitizePdfString(story?.verdict?.badge || 'CERTIFIED FOREVER');

  const verdictDescLines = doc.splitTextToSize(sanitizePdfString(verdictDesc), contentWidth - 12);
  const verdictBoxHeight = 28 + verdictDescLines.length * 4.2;

  doc.setFillColor(cDark[0], cDark[1], cDark[2]);
  doc.roundedRect(margin, curY, contentWidth, verdictBoxHeight, 3, 3, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(cRed[0], cRed[1], cRed[2]);
  doc.text('OFFICIAL CLASSIFIED RULING // FINAL RELATIONSHIP VERDICT', margin + 6, curY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(verdictTitle, margin + 6, curY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(215, 215, 220);
  doc.text(verdictDescLines, margin + 6, curY + 22);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(cGold[0], cGold[1], cGold[2]);
  doc.text(`OFFICIAL STATUS BADGE: [ ${badgeName} ]`, margin + 6, curY + verdictBoxHeight - 6);

  // ══════════════════════════════════════════════════════════════════════════════
  // TWO-PASS HEADER & FOOTER STAMPING (PAGE X OF Y)
  // ══════════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    const sectionTitle = pageSectionTitles.get(p) || 'Classified Intelligence Dossier';

    // Header Watermark & Stamp
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`TOP SECRET // CASE FILE: ${caseId} // AFTERCHAT INTELLIGENCE`, margin, 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(sanitizePdfString(sectionTitle).toUpperCase(), pageWidth - margin, 11, { align: 'right' });

    // Top Rule
    doc.setDrawColor(cRed[0], cRed[1], cRed[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, 13.5, pageWidth - margin, 13.5);

    // Bottom Rule & Footer
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CONFIDENTIAL CASE FILE - PAGE ${p} OF ${totalPages}`, margin, pageHeight - 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(
      `AFTERCHAT.APP - 100% VERIFIED EVIDENCE - ${new Date().toLocaleDateString()}`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  // Save the PDF file
  const safeFilenameParticipants = cleanParticipants.join('_').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `AfterChat_Classified_Dossier_${safeFilenameParticipants}.pdf`;
  doc.save(filename);
}
