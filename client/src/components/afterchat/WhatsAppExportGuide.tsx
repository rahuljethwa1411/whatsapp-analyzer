const steps = [
  'Open the WhatsApp chat you want to explore',
  'Tap the chat name, then choose Export chat',
  'Choose Without media',
  'Save or share the .txt or .zip file directly here',
];

export function WhatsAppExportGuide() {
  return (
    <aside className="export-guide" aria-label="How to export a WhatsApp chat">
      <p className="eyebrow">HOW TO EXPORT FROM WHATSAPP</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="export-guide-note">
        You only need the text export. No screenshots, media, login, or WhatsApp connection needed.
      </p>
    </aside>
  );
}
