/**
 * Classified PDF Dossier Exporter for AfterChat
 *
 * Generates an ultra-premium, high-resolution 6-page investigative case file
 * styled like a top-secret intelligence agency dossier.
 *
 * Sanitizes all text for standard PDF font compatibility (zero Unicode / emoji mojibake)
 * and strips all raw internal message IDs.
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

  // Set PDF document metadata so PDF readers & browsers display the official title instead of localhost URL
  doc.setProperties({
    title: `AfterChat Classified Dossier - ${participantsStr}`,
    subject: `Forensic WhatsApp Archive Analysis (${totalMsgs} messages, ${durationDays} days)`,
    author: 'AfterChat Forensic Intelligence',
    keywords: 'afterchat, whatsapp, intelligence, case file, dossier',
    creator: 'AfterChat Intelligence Agency (afterchat.app)',
  });

  let currentPage = 1;

  // ─── Theme Colors ─────────────────────────────────────────────────────────
  const cRed = [204, 81, 61];        // #cc513d Crimson
  const cDark = [18, 20, 26];       // #12141a Obsidian Dark
  const cGold = [180, 130, 30];      // Amber Gold
  const cCard = [248, 246, 240];     // Off-white Parchment
  const cBorder = [225, 220, 210];   // Line border
  const cTextDark = [25, 25, 30];    // Primary text
  const cTextMuted = [100, 95, 90];  // Secondary text

  // ─── Header & Footer Helper ───────────────────────────────────────────────
  const renderHeaderFooter = (pageNumber: number, sectionTitle: string) => {
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
    doc.text(`CONFIDENTIAL CASE FILE - PAGE ${pageNumber} OF 6`, margin, pageHeight - 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(`AFTERCHAT.APP - 100% VERIFIED EVIDENCE - ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  };

  // Helper: Split and print wrapped text
  const printWrapped = (text: string, x: number, y: number, maxWidth: number, lineHeight = 4.5): number => {
    const safeText = sanitizePdfString(text);
    const lines = doc.splitTextToSize(safeText, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER & EXECUTIVE CASE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  renderHeaderFooter(currentPage, 'Executive Case Summary');

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
  let curY = 36;
  const rawTitle = story?.title || 'THE COMPLETE WHATSAPP FORENSIC DOSSIER';
  curY = printWrapped(rawTitle, margin, curY, contentWidth, 7);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  const rawSubtitle = story?.subtitle || `A forensic breakdown of ${participantsStr}`;
  curY = printWrapped(rawSubtitle, margin, curY + 1, contentWidth, 4.8);

  // Case Metadata Plaque
  curY += 4;
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

  // Executive Opening Narrative
  curY += 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('I. EXECUTIVE INVESTIGATION OPENING', margin, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(45, 45, 50);
  const openingText = story?.opening ||
    `This dossier documents the complete forensic analysis of the exported WhatsApp conversation archive between ${participantsStr}. Over ${totalMsgs} verified messages spanning ${durationDays} days, the archive captures a high-density dynamic defined by signature texting rhythms, unhinged banter, late-night disclosures, and verifiable relationship milestones.`;
  curY = printWrapped(openingText, margin, curY, contentWidth, 4.5);

  // Ground Truth Telemetry Cards
  curY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('II. ARCHIVE TELEMETRY & BEHAVIORAL VITALS', margin, curY);

  curY += 5;
  const statBoxWidth = (contentWidth - 8) / 3;
  const topEmojiClean = analysis?.emojis.mostUsedEmoji ? sanitizePdfString(analysis.emojis.mostUsedEmoji) || '[Skull]' : '[Top Emoji]';
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
    doc.setFontSize(11);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(st.val, bx + statBoxWidth / 2, curY + 7, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(st.label, bx + statBoxWidth / 2, curY + 12.5, { align: 'center' });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2: CHAPTERS 01 – 05
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 2;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Chapters 01-05)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('III. THE NARRATIVE CHRONICLES (PART 1)', margin, 21);

  curY = 26;
  const chaptersPart1 = (story?.chapters || []).slice(0, 5);

  chaptersPart1.forEach((ch, idx) => {
    if (curY > pageHeight - 38) return;

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 39, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CHAPTER 0${idx + 1} // ${sanitizePdfString(ch.period).toUpperCase() || 'ARCHIVE ERA'}`, margin + 4, curY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(ch.title).slice(0, 80), margin + 4, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(45, 45, 50);
    const cleanedNarrative = cleanNarrative(ch.narrative);
    const narrPreview = cleanedNarrative.length > 340 ? cleanedNarrative.slice(0, 337) + '...' : cleanedNarrative;
    printWrapped(narrPreview, margin + 4, curY + 16.5, contentWidth - 8, 3.8);

    curY += 43;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3: CHAPTERS 06 – 10
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 3;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Chapters 06-10)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('IV. THE NARRATIVE CHRONICLES (PART 2)', margin, 21);

  curY = 26;
  const chaptersPart2 = (story?.chapters || []).slice(5, 10);

  chaptersPart2.forEach((ch, idx) => {
    if (curY > pageHeight - 38) return;
    const chapNum = idx + 6;

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 39, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CHAPTER ${chapNum < 10 ? '0' + chapNum : chapNum} // ${sanitizePdfString(ch.period).toUpperCase() || 'ARCHIVE ERA'}`, margin + 4, curY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(ch.title).slice(0, 80), margin + 4, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(45, 45, 50);
    const cleanedNarrative = cleanNarrative(ch.narrative);
    const narrPreview = cleanedNarrative.length > 340 ? cleanedNarrative.slice(0, 337) + '...' : cleanedNarrative;
    printWrapped(narrPreview, margin + 4, curY + 16.5, contentWidth - 8, 3.8);

    curY += 43;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4: STORY ERAS & TOPIC EVOLUTION
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 4;
  renderHeaderFooter(currentPage, 'Chronological Story Eras');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('V. RELATIONSHIP ERAS & CHRONOLOGICAL SHIFTS', margin, 21);

  curY = 26;
  const eras = (intelligence?.eras || []).slice(0, 5);

  eras.forEach((era, idx) => {
    if (curY > pageHeight - 40) return;

    doc.setFillColor(249, 247, 243);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 39, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`PHASE 0${idx + 1} - ${sanitizePdfString(era.startAt || 'START')} TO ${sanitizePdfString(era.endAt || 'END')}`, margin + 4, curY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(era.title).slice(0, 75), margin + 4, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 55);
    const cleanedSummary = cleanNarrative(era.summary);
    const eraSummary = cleanedSummary.length > 300 ? cleanedSummary.slice(0, 297) + '...' : cleanedSummary;
    printWrapped(eraSummary, margin + 4, curY + 16.5, contentWidth - 8, 3.6);

    if (era.dominantTopics?.length) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(cGold[0], cGold[1], cGold[2]);
      const domThemes = sanitizePdfString(era.dominantTopics.slice(0, 4).join(' * '));
      doc.text(`DOMINANT THEMES: ${domThemes}`, margin + 4, curY + 35.5);
    }

    curY += 43;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 5: THE CAST & RECOVERED LORE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 5;
  renderHeaderFooter(currentPage, 'Cast Dossier & Inside Lore');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VI. THE PARTICIPANT DOSSIER (OBSERVED BEHAVIOR)', margin, 21);

  curY = 25;
  const characters = (intelligence?.characters || []).slice(0, 2);
  characters.forEach((char) => {
    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 31, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(sanitizePdfString(char.title || 'SUBJECT PROFILE').toUpperCase(), margin + 4, curY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(cleanParticipantName(char.participant), margin + 4, curY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 55);
    const cleanedDesc = cleanNarrative(char.description);
    const desc = cleanedDesc.length > 280 ? cleanedDesc.slice(0, 277) + '...' : cleanedDesc;
    printWrapped(desc, margin + 4, curY + 15.5, contentWidth - 8, 3.4);

    curY += 34;
  });

  // Plot Twists & Turning Points
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VII. CRITICAL PLOT TWISTS & TIMELINE SHIFTS', margin, curY + 4);

  curY += 8;
  const plotTwists = (intelligence?.plotTwists || []).slice(0, 2);
  plotTwists.forEach((twist, tIdx) => {
    if (curY > pageHeight - 55) return;

    doc.setFillColor(253, 248, 246);
    doc.setDrawColor(230, 200, 190);
    doc.roundedRect(margin, curY, contentWidth, 24, 1.5, 1.5, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    const periodStr = twist.beforePeriod && twist.afterPeriod ? ` // ${sanitizePdfString(twist.beforePeriod)} -> ${sanitizePdfString(twist.afterPeriod)}` : '';
    doc.text(`PLOT TWIST #${tIdx + 1}${periodStr}`, margin + 4, curY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(sanitizePdfString(twist.title).slice(0, 70), margin + 4, curY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 55);
    const twistDesc = cleanNarrative(twist.description);
    printWrapped(twistDesc.length > 180 ? twistDesc.slice(0, 177) + '...' : twistDesc, margin + 4, curY + 14.5, contentWidth - 8, 3.3);

    curY += 27;
  });

  // Recovered Lore
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VIII. RECOVERED INSIDE JOKE LORE & RUNNING GAGS', margin, curY + 3);

  curY += 7;
  const loreItems = (intelligence?.lore || []).slice(0, 2);
  loreItems.forEach((lore) => {
    if (curY > pageHeight - 24) return;
    doc.setFillColor(245, 243, 237);
    doc.roundedRect(margin, curY, contentWidth, 18, 1.5, 1.5, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(cGold[0], cGold[1], cGold[2]);
    doc.text(`MEME / INSIDE JOKE: "${sanitizePdfString(lore.title).toUpperCase()}"`, margin + 4, curY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 55);
    const cleanedLoreDesc = cleanNarrative(lore.description);
    const loreDesc = cleanedLoreDesc.length > 180 ? cleanedLoreDesc.slice(0, 177) + '...' : cleanedLoreDesc;
    printWrapped(loreDesc, margin + 4, curY + 9.5, contentWidth - 8, 3.3);

    curY += 21;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 6: SATIRICAL AWARDS & FINAL CASE VERDICT
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 6;
  renderHeaderFooter(currentPage, 'Official Verdict & Awards');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VIII. THE ANNUAL SATIRICAL AWARDS CEREMONY', margin, 21);

  curY = 26;
  const awards = (story?.awards || []).slice(0, 4);
  awards.forEach((award) => {
    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    const cleanAwardRecipient = cleanParticipantName(award.recipient);
    doc.text(`[AWARD] ${sanitizePdfString(award.title)} -> ${cleanAwardRecipient}`, margin + 4, curY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 55);
    const cleanedReason = cleanNarrative(award.reason);
    printWrapped(cleanedReason, margin + 4, curY + 12, contentWidth - 8, 3.6);

    curY += 25;
  });

  // Final Dramatic Verdict Box (Obsidian Dark Luxury Box)
  curY += 2;
  doc.setFillColor(cDark[0], cDark[1], cDark[2]);
  doc.roundedRect(margin, curY, contentWidth, 55, 3, 3, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(cRed[0], cRed[1], cRed[2]);
  doc.text('OFFICIAL CLASSIFIED RULING // FINAL RELATIONSHIP VERDICT', margin + 6, curY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfString(story?.verdict?.title || 'PERMANENTLY ENTANGLED DIGITAL CHAOS'), margin + 6, curY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(215, 215, 220);
  const verdictDesc = cleanNarrative(
    story?.verdict?.description ||
      `After comprehensive forensic analysis of the chat archive between ${participantsStr}, the evidence confirms an unhinged, deeply grounded dynamic that thrives on chaotic banter, delayed replies, and shared history.`
  );
  printWrapped(verdictDesc, margin + 6, curY + 24, contentWidth - 12, 4);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(cGold[0], cGold[1], cGold[2]);
  const badgeName = sanitizePdfString(story?.verdict?.badge || 'CERTIFIED FOREVER');
  doc.text(`OFFICIAL STATUS BADGE: [ ${badgeName} ]`, margin + 6, curY + 48);

  // Save the PDF file
  const safeFilenameParticipants = cleanParticipants.join('_').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `AfterChat_Classified_Dossier_${safeFilenameParticipants}.pdf`;
  doc.save(filename);
}
