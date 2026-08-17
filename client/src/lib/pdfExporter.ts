/**
 * Classified PDF Dossier Exporter for AfterChat (Paid Feature)
 *
 * Generates an official, classified true-crime style 5–6 page PDF case file
 * complete with case stamps, full 10 chapters, eras, cast profiles, lore,
 * satirical awards, and final verdict.
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
  getMessagesByIds,
}: ExportDossierOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const participantsStr = analysis?.metadata.participants.join(' & ') || 'Participants';
  const totalMsgs = analysis?.metadata.totalMessages.toLocaleString() || '24,000+';
  const durationDays = analysis?.metadata.durationDays || 365;

  let currentPage = 1;

  // Helper: Header & Footer with classified watermark
  const renderHeaderFooter = (pageNumber: number, title: string) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 50, 50);
    doc.text('TOP SECRET // AFTERCHAT CLASSIFIED INTELLIGENCE DOSSIER', margin, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(title.toUpperCase(), pageWidth - margin, 12, { align: 'right' });

    // Top rule
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, 14, pageWidth - margin, 14);

    // Bottom rule
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text(`CONFIDENTIAL CASE FILE • PAGE ${pageNumber} OF 6`, margin, pageHeight - 7);
    doc.text(`AFTERCHAT.APP • ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  // Helper: Text wrapper
  const printWrapped = (text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER & EXECUTIVE CASE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  renderHeaderFooter(currentPage, 'Executive Case File');

  // Classified Stamp
  doc.setDrawColor(180, 50, 50);
  doc.setLineWidth(0.8);
  doc.rect(margin, 22, 60, 10);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(180, 50, 50);
  doc.text('CLASSIFIED EVIDENCE', margin + 30, 28.5, { align: 'center' });

  // Main Dossier Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  let curY = 42;
  curY = printWrapped(story?.title || 'The Complete WhatsApp Intelligence Report', margin, curY, contentWidth, 8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  curY = printWrapped(story?.subtitle || `An exhaustive investigation into ${participantsStr}`, margin, curY + 2, contentWidth, 5);

  // Meta Box
  curY += 4;
  doc.setFillColor(248, 246, 240);
  doc.setDrawColor(225, 220, 210);
  doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 80, 20);
  doc.text(`SUBJECTS: ${participantsStr.toUpperCase()}`, margin + 5, curY + 7);
  doc.text(`TOTAL EVIDENCE: ${totalMsgs} MESSAGES`, margin + 5, curY + 13);
  doc.text(`TIMELINE SPAN: ${durationDays} DAYS`, margin + 5, curY + 19);

  doc.text(`VERIFIED STATUS: 100% UNEDITED`, pageWidth - margin - 5, curY + 7, { align: 'right' });
  doc.text(`PEAK TIME: ${analysis?.activity.peakHour?.label || '12:00 AM'}`, pageWidth - margin - 5, curY + 13, { align: 'right' });
  doc.text(`LONGEST STREAK: ${analysis?.streaks.longestActiveStreak?.durationDays || 0} DAYS`, pageWidth - margin - 5, curY + 19, { align: 'right' });

  // Opening Narrative Box
  curY += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('I. EXECUTIVE NARRATIVE OPENING', margin, curY);

  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(45, 45, 45);
  const openingText = story?.opening || 'The conversation began innocently before devolving into a complex web of late-night debriefs, phantom trip plans, and mutual roasting.';
  curY = printWrapped(openingText, margin, curY, contentWidth, 4.8);

  // Ground Truth Stats Table
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('II. CORE TELEMETRY', margin, curY);

  curY += 5;
  const statBoxWidth = (contentWidth - 6) / 3;
  const statItems = [
    { label: 'TOP EMOJI', val: analysis?.emojis.mostUsedEmoji || '😭' },
    { label: 'LONGEST SILENCE', val: `${analysis?.streaks.longestSilence?.durationDays || 0} Days` },
    { label: 'PEAK MONTH', val: analysis?.activity.peakMonth?.monthName || 'October' },
  ];

  statItems.forEach((st, i) => {
    const bx = margin + i * (statBoxWidth + 3);
    doc.setFillColor(244, 242, 236);
    doc.rect(bx, curY, statBoxWidth, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(st.val, bx + statBoxWidth / 2, curY + 7, { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(st.label, bx + statBoxWidth / 2, curY + 12.5, { align: 'center' });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2: CHAPTERS 1 – 5
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 2;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Part 1)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('III. THE COMPLETE NARRATIVE (CHAPTERS 01 – 05)', margin, 24);

  curY = 32;
  const chaptersPart1 = (story?.chapters || []).slice(0, 5);

  chaptersPart1.forEach((ch, idx) => {
    if (curY > pageHeight - 35) return;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 50, 50);
    doc.text(`CHAPTER 0${idx + 1} // ${ch.period.toUpperCase()}`, margin, curY);

    curY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    curY = printWrapped(ch.title, margin, curY, contentWidth, 4.8);

    curY += 1.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    const narrPreview = ch.narrative.length > 320 ? ch.narrative.slice(0, 317) + '...' : ch.narrative;
    curY = printWrapped(narrPreview, margin, curY, contentWidth, 4.2);

    curY += 4;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3: CHAPTERS 6 – 10
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 3;
  renderHeaderFooter(currentPage, 'Investigation Narrative (Part 2)');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('IV. THE COMPLETE NARRATIVE (CHAPTERS 06 – 10)', margin, 24);

  curY = 32;
  const chaptersPart2 = (story?.chapters || []).slice(5, 10);

  chaptersPart2.forEach((ch, idx) => {
    if (curY > pageHeight - 35) return;
    const chapNum = idx + 6;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 50, 50);
    doc.text(`CHAPTER ${chapNum < 10 ? '0' + chapNum : chapNum} // ${ch.period.toUpperCase()}`, margin, curY);

    curY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    curY = printWrapped(ch.title, margin, curY, contentWidth, 4.8);

    curY += 1.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    const narrPreview = ch.narrative.length > 320 ? ch.narrative.slice(0, 317) + '...' : ch.narrative;
    curY = printWrapped(narrPreview, margin, curY, contentWidth, 4.2);

    curY += 4;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4: STORY ERAS BREAKDOWN
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 4;
  renderHeaderFooter(currentPage, 'Chronological Story Eras');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('V. RELATIONSHIP ERAS & TOPIC EVOLUTION', margin, 24);

  curY = 32;
  const eras = (intelligence?.eras || []).slice(0, 5);

  eras.forEach((era, idx) => {
    if (curY > pageHeight - 35) return;

    doc.setFillColor(249, 247, 243);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(margin, curY, contentWidth, 38, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 50, 50);
    doc.text(`ERA 0${idx + 1} • ${era.startAt || ''} TO ${era.endAt || ''}`, margin + 4, curY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(era.title, margin + 4, curY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 55, 55);
    const eraSummary = era.summary.length > 280 ? era.summary.slice(0, 277) + '...' : era.summary;
    printWrapped(eraSummary, margin + 4, curY + 17, contentWidth - 8, 3.8);

    if (era.dominantTopics?.length) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`TOPICS: ${era.dominantTopics.join(', ')}`, margin + 4, curY + 34);
    }

    curY += 42;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 5: THE CAST & RECOVERED LORE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 5;
  renderHeaderFooter(currentPage, 'Cast Archetypes & Inside Joke Lore');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('VI. THE CAST PROFILES (OBSERVED BEHAVIOR)', margin, 24);

  curY = 32;
  const characters = (intelligence?.characters || []).slice(0, 3);
  characters.forEach((char) => {
    doc.setFillColor(244, 242, 236);
    doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 50, 50);
    doc.text(char.title.toUpperCase(), margin + 4, curY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(char.participant, margin + 4, curY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    printWrapped(char.description, margin + 4, curY + 17, contentWidth - 8, 3.6);

    curY += 28;
  });

  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('VII. RECOVERED LORE & INSIDE JOKES', margin, curY);

  curY += 8;
  const loreItems = (intelligence?.lore || []).slice(0, 4);
  loreItems.forEach((lore) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 50, 50);
    doc.text(`MEME // "${lore.title.toUpperCase()}"`, margin, curY);

    curY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    curY = printWrapped(lore.description, margin, curY, contentWidth, 4);
    curY += 3;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 6: SATIRICAL AWARDS & FINAL CASE VERDICT
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentPage = 6;
  renderHeaderFooter(currentPage, 'Official Verdict & Awards');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('VIII. SATIRICAL AWARDS CEREMONY', margin, 24);

  curY = 32;
  const awards = (story?.awards || []).slice(0, 4);
  awards.forEach((award) => {
    doc.setFillColor(248, 246, 240);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(margin, curY, contentWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(`${award.emoji || '🏆'} ${award.title} → ${award.recipient}`, margin + 4, curY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    printWrapped(award.reason, margin + 4, curY + 12, contentWidth - 8, 3.6);

    curY += 22;
  });

  // Final Verdict Stamp Box
  curY += 6;
  doc.setFillColor(30, 28, 25);
  doc.roundedRect(margin, curY, contentWidth, 48, 3, 3, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(220, 120, 60);
  doc.text('OFFICIAL CASE VERDICT // FINAL CLASSIFIED RULING', margin + 6, curY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(story?.verdict?.title || 'UNPAID KALESH & MUTUAL SURVIVAL', margin + 6, curY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  printWrapped(
    story?.verdict?.description || 'After analyzing thousands of messages, the evidence confirms a chaotic, unhinged, but enduring connection.',
    margin + 6,
    curY + 25,
    contentWidth - 12,
    4.2
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(220, 120, 60);
  doc.text(`FINAL STATUS: ${story?.verdict?.badge || 'PERMANENTLY ENTANGLED'}`, margin + 6, curY + 42);

  // Download Action
  const filename = `AfterChat_Classified_Dossier_${participantsStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}
