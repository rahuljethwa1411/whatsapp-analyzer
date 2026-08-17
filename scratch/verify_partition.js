function makeMessages(n) {
  const msgs = [];
  for (let i = 0; i < n; i++) {
    msgs.push({
      id: `m_${String(i+1).padStart(6,'0')}`,
      timestamp: new Date(2025,0,1,0,0,i).toISOString(),
      sender: i % 2 === 0 ? 'Rahul' : 'iteeca',
      text: `Msg ${i+1}`,
      type: 'message'
    });
  }
  return msgs;
}

function partitionTopLevel(messages, targetTopLevel = 20) {
  const normal = messages.filter(m => m.type === 'message' && m.text && m.text.trim().length > 0);
  const topLevelCount = Math.max(1, Math.min(targetTopLevel, normal.length));
  const approx = Math.ceil(normal.length / topLevelCount);
  const groups = [];
  let current = [];
  for (let i=0;i<normal.length;i++){
    current.push(normal[i]);
    if (current.length >= approx && groups.length < topLevelCount - 1) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length>0) groups.push(current);
  return groups;
}

const total = 23979;
const msgs = makeMessages(total);
const groups = partitionTopLevel(msgs, 20);
console.log(`[Chunker] Initial partition: ${total} messages → ${groups.length} logical chunks`);
console.log(`[Analyze] ${total.toLocaleString()} messages · ${groups.length} chunks`);
console.log('Sample chunk sizes:', groups.slice(0,5).map(g=>g.length));
