import { parseWhatsAppExport } from '../parser';
import { analyzeChat } from '../../analysis';

export function runTests(): { success: boolean; results: string[] } {
  const logs: string[] = [];
  let passed = true;

  const log = (msg: string) => logs.push(msg);

  log('--- Running WhatsApp Parser & Statistics Engine Tests ---');

  const sampleTxt = `12/08/24, 10:42 pm - Rahul: bro we're actually going Goa this time
12/08/24, 10:43 pm - Aisha: 100%
12/08/24, 10:45 pm - Kabir: booking tomorrow
12/08/24, 10:46 pm - Rahul: bro I wanted to tell you
something really important but I forgot
12/08/24, 11:15 pm - Nikhil: <Media omitted>
13/08/24, 01:17 am - Rahul: 💀 loooool
13/08/24, 01:18 am - Aisha: are you okay?
15/08/24, 09:30 am - Rahul: im on my way
15/08/24, 10:00 am - System: Rahul created group "Goa 2024"
15/08/24, 11:00 am - Kabir: dramatic re-entry 🤡`;

  const parsed = parseWhatsAppExport(sampleTxt);

  // Test 1: Multiline Handling
  const multilineMsg = parsed.messages.find((m) => m.text.includes('something really important'));
  if (multilineMsg && multilineMsg.text.includes('forgot')) {
    log('✅ TEST 1 PASSED: Multiline message correctly preserved.');
  } else {
    log('❌ TEST 1 FAILED: Multiline message split incorrectly.');
    passed = false;
  }

  // Test 2: System Message Detection
  const sysMsg = parsed.messages.find((m) => m.type === 'system');
  if (sysMsg) {
    log(`✅ TEST 2 PASSED: System message detected (${sysMsg.text}).`);
  } else {
    log('❌ TEST 2 FAILED: System message not identified.');
    passed = false;
  }

  // Test 3: Media Placeholder Detection
  const mediaMsg = parsed.messages.find((m) => m.type === 'media');
  if (mediaMsg && mediaMsg.sender === 'Nikhil') {
    log('✅ TEST 3 PASSED: Media message correctly parsed for sender Nikhil.');
  } else {
    log('❌ TEST 3 FAILED: Media message placeholder not detected.');
    passed = false;
  }

  // Test 4: Analysis Model Calculations
  const analysis = analyzeChat(parsed.messages);

  if (analysis.metadata.totalMessages === 8) {
    log(`✅ TEST 4 PASSED: Normal message count matches (8 messages).`);
  } else {
    log(`❌ TEST 4 FAILED: Expected 8 normal messages, got ${analysis.metadata.totalMessages}.`);
    passed = false;
  }

  if (analysis.metadata.totalParticipants === 4) {
    log('✅ TEST 5 PASSED: Participant count matches 4 senders (Rahul, Aisha, Kabir, Nikhil).');
  } else {
    log(`❌ TEST 5 FAILED: Expected 4 senders, got ${analysis.metadata.totalParticipants}.`);
    passed = false;
  }

  if (analysis.emojis.mostUsedEmoji === '💀' || analysis.emojis.mostUsedEmoji === '🤡') {
    log(`✅ TEST 6 PASSED: Emoji extraction extracted '${analysis.emojis.mostUsedEmoji}'.`);
  } else {
    log('❌ TEST 6 FAILED: Emoji extraction failed.');
    passed = false;
  }

  log(`--- Test Suite Completed: ${passed ? 'ALL PASSED' : 'SOME FAILED'} ---`);
  return { success: passed, results: logs };
}
