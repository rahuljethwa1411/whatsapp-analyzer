import { ChatMessage } from '../../types/chat';
import { ConversationSession } from '../../types/analysis';

const DEFAULT_SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

export function calculateSessions(
  messages: ChatMessage[],
  maxGapMs: number = DEFAULT_SESSION_GAP_MS
): ConversationSession[] {
  const normalMessages = messages
    .filter((m) => m.type === 'message')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (normalMessages.length === 0) return [];

  const sessions: ConversationSession[] = [];
  let currentSessionMsgs: ChatMessage[] = [normalMessages[0]];

  for (let i = 1; i < normalMessages.length; i++) {
    const prev = normalMessages[i - 1];
    const curr = normalMessages[i];

    const gapMs = curr.timestamp.getTime() - prev.timestamp.getTime();

    if (gapMs <= maxGapMs) {
      currentSessionMsgs.push(curr);
    } else {
      // Finalize current session
      sessions.push(createSessionObj(sessions.length + 1, currentSessionMsgs));
      currentSessionMsgs = [curr];
    }
  }

  if (currentSessionMsgs.length > 0) {
    sessions.push(createSessionObj(sessions.length + 1, currentSessionMsgs));
  }

  return sessions;
}

function createSessionObj(index: number, msgs: ChatMessage[]): ConversationSession {
  const startAt = msgs[0].timestamp;
  const endAt = msgs[msgs.length - 1].timestamp;
  const durationMs = endAt.getTime() - startAt.getTime();

  const participantSet = new Set<string>();
  msgs.forEach((m) => {
    if (m.sender) participantSet.add(m.sender);
  });

  return {
    id: `session_${index}`,
    startAt,
    endAt,
    messageCount: msgs.length,
    participants: Array.from(participantSet),
    durationMs,
  };
}
