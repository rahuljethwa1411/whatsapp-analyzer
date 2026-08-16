/**
 * ReportNavigation Component
 * Minimal floating editorial navbar for quick navigation between report sections.
 */

import { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'sec-opening', label: '01 HERO' },
  { id: 'sec-snapshot', label: '02 STATS' },
  { id: 'sec-story', label: '03 STORY' },
  { id: 'sec-eras', label: '04 ERAS' },
  { id: 'sec-characters', label: '05 CAST' },
  { id: 'sec-twists', label: '06 TWISTS' },
  { id: 'sec-lore', label: '07 LORE' },
  { id: 'sec-awards', label: '08 AWARDS' },
  { id: 'sec-verdict', label: '09 VERDICT' },
];

export function ReportNavigation() {
  const [activeSection, setActiveSection] = useState('sec-opening');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="report-floating-nav">
      <div className="report-nav-items">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={'report-nav-item ' + (activeSection === sec.id ? 'active' : '')}
            onClick={() => scrollTo(sec.id)}
          >
            {sec.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
