import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendReportEmail } from '../server/lib/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

async function testLiveEmail() {
  console.log('Testing live email dispatch with current SMTP credentials...');
  console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`SMTP_PASS configured: ${process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('your_16_char') ? '✅ Yes' : '❌ Placeholder (needs 16-char App Password)'}`);

  const recipient = process.env.SMTP_USER || 'iamafterchat@gmail.com';
  console.log(`\nAttempting test delivery to: ${recipient}...`);

  const result = await sendReportEmail({
    to: recipient,
    participants: 'Rahul & iteeca💫',
    totalMessages: 23979,
    storyTitle: 'OPERATION DELHI TICKETS & TEARY CRICKET: THE COMPLETE TEXTUAL AUTOPSY',
    overallTone: 'Chaotic, Observational & Banter-Heavy',
    verdict: 'A legendary 344-day WhatsApp conversation archive documented forever.',
    paymentId: 'pay_TEST_VERIFIED_12345',
  });

  console.log('\nEmail dispatch result:', result);
}

testLiveEmail().catch(console.error);
