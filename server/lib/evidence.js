/**
 * Evidence Retriever
 * Validates and retrieves real messages by ID.
 * Critical for receipts — never allows invented message IDs.
 */

/**
 * Build a fast lookup map from all messages.
 * @param {Array} allMessages — all ChatMessage[] from the request
 * @returns {Map<string, Object>}
 */
export function buildMessageIndex(allMessages) {
  const index = new Map();
  for (const m of allMessages) {
    index.set(m.id, m);
  }
  return index;
}

/**
 * Retrieves messages by IDs.
 * Only returns IDs that actually exist in the index.
 * Silently drops any invented or invalid IDs.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {Array}
 */
export function getMessagesByIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter(id => messageIndex.has(id))
    .map(id => messageIndex.get(id));
}

/**
 * Validates an array of message IDs against the real index.
 * Returns only the valid IDs.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {string[]}
 */
export function validateMessageIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids.filter(id => typeof id === 'string' && messageIndex.has(id));
}

/**
 * Validates all evidenceMessageIds across an entire intelligence object.
 * Strips invalid IDs from every insight without removing the insight itself.
 * An insight with ZERO valid IDs after stripping is still kept (just without receipts).
 * @param {Object} intelligence — AfterchatIntelligence
 * @param {Map<string, Object>} messageIndex
 * @returns {Object} — cleaned intelligence
 */
export function validateIntelligenceEvidence(intelligence, messageIndex) {
  const clean = obj => {
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'evidenceMessageIds') {
          result[key] = validateMessageIds(val, messageIndex);
        } else {
          result[key] = clean(val);
        }
      }
      return result;
    }
    return obj;
  };

  return clean(intelligence);
}
