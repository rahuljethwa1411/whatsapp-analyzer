import { useState } from 'react';
import { motion } from 'framer-motion';

const segments = [
  { label: 'Banter', pct: 42, color: '#cc513d', desc: 'Inside jokes, roast sessions, meme spams' },
  { label: 'Nonsense', pct: 27, color: '#d97736', desc: '3 AM thoughts, unprovoked sticker drops' },
  { label: 'Emotional', pct: 19, color: '#4a7c59', desc: 'Heart-to-hearts, post-breakup check-ins' },
  { label: 'Logistics', pct: 12, color: '#5b7b9a', desc: 'Who has the car, bill splitting, Goa plans' },
];

export function GenreChart() {
  const [hoveredSegment, setHoveredSegment] = useState<typeof segments[0] | null>(null);

  return (
    <div className="genre-chart-container">
      <div className="genre-bar-track">
        {segments.map((seg) => (
          <motion.div
            key={seg.label}
            className="genre-bar-segment"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            whileHover={{ scaleY: 1.15 }}
            onMouseEnter={() => setHoveredSegment(seg)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <span className="segment-label">{seg.pct}%</span>
          </motion.div>
        ))}
      </div>

      <div className="genre-legend-grid">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={'legend-item ' + (hoveredSegment?.label === seg.label ? 'active' : '')}
            onMouseEnter={() => setHoveredSegment(seg)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <span className="legend-color-dot" style={{ backgroundColor: seg.color }} />
            <span className="legend-title">{seg.label}</span>
            <b className="legend-pct">{seg.pct}%</b>
          </div>
        ))}
      </div>

      {hoveredSegment && (
        <motion.div
          className="genre-tooltip-box"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="tooltip-badge" style={{ backgroundColor: hoveredSegment.color }}>
            {hoveredSegment.label} · {hoveredSegment.pct}%
          </span>
          <p>{hoveredSegment.desc}</p>
        </motion.div>
      )}
    </div>
  );
}
