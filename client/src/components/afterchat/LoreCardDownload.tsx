import { useState, useRef } from 'react';
import { useChatAnalysis } from '../../context/ChatAnalysisContext';

interface LoreCardDownloadProps {
  title?: string;
  stats?: string;
}

export function LoreCardDownload({
  title,
  stats,
}: LoreCardDownloadProps) {
  const { analysis } = useChatAnalysis();
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cardTitle = title || (analysis ? analysis.metadata.participants.slice(0, 4).join(', ') : 'Documentary Archive');
  const cardStats = stats || (analysis ? `${analysis.metadata.totalMessages.toLocaleString()} messages · Peak ${analysis.activity.peakHour?.label || '11 PM'} · Top ${analysis.emojis.mostUsedEmoji || '💀'}` : '24,821 messages · 7 Eras · 17 Goa mentions · 0 trips taken');

  const handleGenerateAndDownload = () => {
    setDownloading(true);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setDownloading(false);
      return;
    }

    // Background - Dark Paper Card
    ctx.fillStyle = '#201f1c';
    ctx.fillRect(0, 0, 800, 500);

    // Accent Top Border
    ctx.fillStyle = '#cc513d';
    ctx.fillRect(0, 0, 800, 8);

    // Decorative Card Frame
    ctx.strokeStyle = '#3d3a34';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 740, 440);

    // Header Badge
    ctx.fillStyle = '#cc513d';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('AFTERCHAT ✦ OFFICIAL DOCUMENTARY RECEIPT', 60, 80);

    // Title
    ctx.fillStyle = '#f4f0e8';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText(cardTitle, 60, 140);

    // Subtitle / Stats
    ctx.fillStyle = '#b8b0a0';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(cardStats, 60, 185);

    // Divider Line
    ctx.strokeStyle = '#4a463e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 220);
    ctx.lineTo(740, 220);
    ctx.stroke();

    // Key Lore Quote
    ctx.fillStyle = '#cc513d';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText('KEY RECURRING LORE', 60, 260);

    ctx.fillStyle = '#e8e0d2';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('“Goa this summer?” → “100%” → (17 mentions, 0 trips taken)', 60, 300);

    // Genre Tag
    ctx.fillStyle = '#eae3d6';
    ctx.fillRect(60, 340, 180, 36);

    ctx.fillStyle = '#201f1c';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('GENRE: CHAOTIC COMFORT', 75, 363);

    // Footer Credit
    ctx.fillStyle = '#8a8376';
    ctx.font = '14px Georgia, serif';
    ctx.fillText('Made with ❤️ by AfterChat · afterchat.fun', 60, 435);

    ctx.fillStyle = '#cc513d';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('AFTERCHAT ✦', 640, 435);

    // Convert to Image & Download
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `AfterChat_${cardTitle.replace(/[^a-zA-Z0-0]/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      setDownloading(false);
    }, 400);
  };

  return (
    <button
      type="button"
      className="button download-lore-card-btn"
      onClick={handleGenerateAndDownload}
      disabled={downloading}
    >
      {downloading ? 'Generating PNG Card...' : 'Download Lore PNG Card 📥'}
    </button>
  );
}
