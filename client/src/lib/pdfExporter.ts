/**
 * Classified PDF Dossier Exporter for AfterChat
 *
 * Generates an ultra-premium, high-resolution 6-page investigative case file
 * styled like a top-secret intelligence agency dossier.
 */

import jsPDF from 'jspdf';
import { Story } from '../types/story';
import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';
import { ChatMessage } from '../types/chat';

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

  const participantsStr = analysis?.metadata.participants.join(' & ') || 'Participants';
  const totalMsgs = (analysis?.metadata.totalMessages || 23979).toLocaleString();
  const durationDays = analysis?.metadata.durationDays || 365;
  const caseId = `AC-${Math.floor(100000 + Math.random() * 900000)}`;

  let currentPage = 1;

  // ─── Theme Colors ─────────────────────────────────────────────────────────
  const cRed = [204, 81, 61];        // #cc513d Crimson
  const cDark = [18, 20, 26];       // #12141a Obsidian Dark
  const cGold = [217, 158, 38];      // #d99e26 Amber Gold
  const cCard = [248, 246, 240];     // #f8f6f0 Off-white Parchment
  const cBorder = [225, 220, 210];   // #e1dcd2 Line border
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
    doc.text(sectionTitle.toUpperCase(), pageWidth - margin, 11, { align: 'right' });

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
    doc.text(`CONFIDENTIAL CASE FILE • PAGE ${pageNumber} OF 6`, margin, pageHeight - 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(`AFTERCHAT.APP • 100% VERIFIED EVIDENCE • ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  };

  // Helper: Split and print wrapped text
  const printWrapped = (text: string, x: number, y: number, maxWidth: number, lineHeight = 4.5): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
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
  doc.roundedRect(margin, 20, 52, 9, 1.5, 1.5, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(cRed[0], cRed[1], cRed[2]);
  doc.text('🔒 CLASSIFIED EVIDENCE', margin + 26, 25.8, { align: 'center' });

  // Barcode / Case ID
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  doc.text(`CASE REF: ${caseId} • ARCHIVE INVESTIGATION`, pageWidth - margin, 25.8, { align: 'right' });

  // Main Dossier Headline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  let curY = 38;
  curY = printWrapped(story?.title || 'THE COMPLETE WHATSAPP FORENSIC DOSSIER', margin, curY, contentWidth, 7.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
  curY = printWrapped(story?.subtitle || `A forensic breakdown of ${participantsStr}`, margin, curY + 1.5, contentWidth, 5);

  // Case Metadata Plaque
  curY += 4;
  doc.setFillColor(cCard[0], cCard[1], cCard[2]);
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.roundedRect(margin, curY, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cGold[0], cGold[1], cGold[2]);
  doc.text(`SUBJECTS: ${participantsStr.toUpperCase()}`, margin + 5, curY + 7);
  doc.text(`TOTAL EVIDENCE: ${totalMsgs} MESSAGES`, margin + 5, curY + 13.5);
  doc.text(`TIMELINE SPAN: ${durationDays} DAYS`, margin + 5, curY + 20);

  doc.text(`STATUS: 100% UNEDITED`, pageWidth - margin - 5, curY + 7, { align: 'right' });
  doc.text(`PEAK TIME: ${analysis?.activity.peakHour?.label || '11:00 PM'}`, pageWidth - margin - 5, curY + 13.5, { align: 'right' });
  doc.text(`LONGEST STREAK: ${analysis?.streaks.longestActiveStreak?.durationDays || 0} DAYS`, pageWidth - margin - 5, curY + 20, { align: 'right' });

  // Executive Opening Narrative
  curY += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('I. EXECUTIVE INVESTIGATION OPENING', margin, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(45, 45, 50);
  const openingText = story?.opening || 'The uploaded conversation represents a high-density digital archive characterized by rapid banter, late-night disclosures, phantom plans, and mutual roasting.';
  curY = printWrapped(openingText, margin, curY, contentWidth, 4.8);

  // Ground Truth Telemetry Cards
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('II. ARCHIVE TELEMETRY & BEHAVIORAL VITALS', margin, curY);

  curY += 5;
  const statBoxWidth = (contentWidth - 8) / 3;
  const statItems = [
    { label: 'TOP SIGNATURE EMOJI', val: analysis?.emojis.mostUsedEmoji || '💀' },
    { label: 'LONGEST SILENCE GAP', val: `${analysis?.streaks.longestSilence?.durationDays || 0} Days` },
    { label: 'PEAK CHAT MONTH', val: analysis?.activity.peakMonth?.monthName || 'March' },
  ];

  statItems.forEach((st, i) => {
    const bx = margin + i * (statBoxWidth + 4);
    doc.setFillColor(243, 240, 233);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(bx, curY, statBoxWidth, 17, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(st.val, bx + statBoxWidth / 2, curY + 7.5, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(st.label, bx + statBoxWidth / 2, curY + 13, { align: 'center' });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2: CHAPTERS 01 – 05
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 2;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Chapters 01–05)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('III. THE NARRATIVE CHRONICLES (PART 1)', margin, 22);

  curY = 28;
  const chaptersPart1 = (story?.chapters || []).slice(0, 5);

  chaptersPart1.forEach((ch, idx) => {
    if (curY > pageHeight - 38) return;

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 38, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CHAPTER 0${idx + 1} // ${ch.period.toUpperCase() || 'ARCHIVE ERA'}`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(ch.title.slice(0, 75), margin + 4, curY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 50);
    const narrPreview = ch.narrative.length > 290 ? ch.narrative.slice(0, 287) + '...' : ch.narrative;
    printWrapped(narrPreview, margin + 4, curY + 17.5, contentWidth - 8, 4);

    curY += 42;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3: CHAPTERS 06 – 10
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 3;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Chapters 06–10)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('IV. THE NARRATIVE CHRONICLES (PART 2)', margin, 22);

  curY = 28;
  const chaptersPart2 = (story?.chapters || []).slice(5, 10);

  chaptersPart2.forEach((ch, idx) => {
    if (curY > pageHeight - 38) return;
    const chapNum = idx + 6;

    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 38, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`CHAPTER ${chapNum < 10 ? '0' + chapNum : chapNum} // ${ch.period.toUpperCase() || 'ARCHIVE ERA'}`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(ch.title.slice(0, 75), margin + 4, curY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 50);
    const narrPreview = ch.narrative.length > 290 ? ch.narrative.slice(0, 287) + '...' : ch.narrative;
    printWrapped(narrPreview, margin + 4, curY + 17.5, contentWidth - 8, 4);

    curY += 42;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4: STORY ERAS & TOPIC EVOLUTION
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 4;
  renderHeaderFooter(currentPage, 'Chronological Story Eras');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('V. RELATIONSHIP ERAS & CHRONOLOGICAL SHIFTS', margin, 22);

  curY = 28;
  const eras = (intelligence?.eras || []).slice(0, 5);

  eras.forEach((era, idx) => {
    if (curY > pageHeight - 38) return;

    doc.setFillColor(249, 247, 243);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 38, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(`PHASE 0${idx + 1} • ${era.startAt || 'START'} TO ${era.endAt || 'END'}`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(era.title, margin + 4, curY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 55);
    const eraSummary = era.summary.length > 270 ? era.summary.slice(0, 267) + '...' : era.summary;
    printWrapped(eraSummary, margin + 4, curY + 17.5, contentWidth - 8, 3.8);

    if (era.dominantTopics?.length) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(cGold[0], cGold[1], cGold[2]);
      doc.text(`DOMINANT THEMES: ${era.dominantTopics.slice(0, 4).join(' • ')}`, margin + 4, curY + 34);
    }

    curY += 42;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 5: THE CAST & RECOVERED LORE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 5;
  renderHeaderFooter(currentPage, 'Cast Dossier & Inside Lore');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VI. THE PARTICIPANT DOSSIER (OBSERVED BEHAVIOR)', margin, 22);

  curY = 28;
  const characters = (intelligence?.characters || []).slice(0, 2);
  characters.forEach((char) => {
    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 32, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(cRed[0], cRed[1], cRed[2]);
    doc.text(char.title.toUpperCase() || 'SUBJECT PROFILE', margin + 4, curY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(char.participant, margin + 4, curY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 55);
    const desc = char.description.length > 280 ? char.description.slice(0, 277) + '...' : char.description;
    printWrapped(desc, margin + 4, curY + 18.5, contentWidth - 8, 3.8);

    curY += 36;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VII. RECOVERED INSIDE JOKE LORE & RUNNING GAGS', margin, curY + 4);

  curY += 10;
  const loreItems = (intelligence?.lore || []).slice(0, 4);
  loreItems.forEach((lore) => {
    if (curY > pageHeight - 30) return;
    doc.setFillColor(245, 243, 237);
    doc.roundedRect(margin, curY, contentWidth, 18, 1.5, 1.5, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(cGold[0], cGold[1], cGold[2]);
    doc.text(`MEME / INSIDE JOKE: "${lore.title.toUpperCase()}"`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 55);
    const loreDesc = lore.description.length > 180 ? lore.description.slice(0, 177) + '...' : lore.description;
    printWrapped(loreDesc, margin + 4, curY + 11.5, contentWidth - 8, 3.8);

    curY += 21;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 6: SATIRICAL AWARDS & FINAL CASE VERDICT
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 6;
  renderHeaderFooter(currentPage, 'Official Verdict & Awards');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(cDark[0], cDark[1], cDark[2]);
  doc.text('VIII. THE ANNUAL SATIRICAL AWARDS CEREMONY', margin, 22);

  curY = 28;
  const awards = (story?.awards || []).slice(0, 4);
  awards.forEach((award) => {
    doc.setFillColor(cCard[0], cCard[1], cCard[2]);
    doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
    doc.roundedRect(margin, curY, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.text(`${award.emoji || '🏆'} ${award.title} → ${award.recipient}`, margin + 4, curY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 55);
    printWrapped(award.reason, margin + 4, curY + 13, contentWidth - 8, 3.8);

    curY += 24;
  });

  // Final Dramatic Verdict Box (Obsidian Dark Luxury Box)
  curY += 4;
  doc.setFillColor(cDark[0], cDark[1], cDark[2]);
  doc.roundedRect(margin, curY, contentWidth, 54, 3, 3, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cRed[0], cRed[1], cRed[2]);
  doc.text('OFFICIAL CLASSIFIED RULING // FINAL RELATIONSHIP VERDICT', margin + 6, curY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(story?.verdict?.title || 'PERMANENTLY ENTANGLED DIGITAL CHAOS', margin + 6, curY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(215, 215, 220);
  printWrapped(
    story?.verdict?.description || 'After comprehensive forensic analysis of the chat archive, the evidence confirms an unhinged, deeply grounded dynamic that survives delayed replies and mutual chaos.',
    margin + 6,
    curY + 26,
    contentWidth - 12,
    4.5
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cGold[0], cGold[1], cGold[2]);
  doc.text(`OFFICIAL STATUS BADGE: [ ${story?.verdict?.badge || 'CERTIFIED FOREVER'} ]`, margin + 6, curY + 47);

  // Save the PDF file
  const filename = `AfterChat_Classified_Dossier_${participantsStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}
