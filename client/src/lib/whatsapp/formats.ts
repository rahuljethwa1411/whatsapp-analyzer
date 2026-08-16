export const HEADER_PATTERNS = [
  // 12/08/24, 10:42 pm - Sender: Text  OR  12/08/2024, 22:42 - Sender: Text
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\s*[\-\–]\s*(.+)$/,

  // [12/08/24, 10:42:15 PM] Sender: Text
  /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\]\s*(.+)$/,

  // 12.08.24, 10:42 - Sender: Text
  /^(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\s*[\-\–]\s*(.+)$/,
];

export const MEDIA_PATTERNS = [
  /<media omitted>/i,
  /image omitted/i,
  /video omitted/i,
  /audio omitted/i,
  /sticker omitted/i,
  /document omitted/i,
  /GIF omitted/i,
  /voice message omitted/i,
  /contact card omitted/i,
  /location omitted/i,
];

export const SYSTEM_PATTERNS = [
  /end-to-end encrypted/i,
  /created group/i,
  /added/i,
  /left$/i,
  /removed/i,
  /changed the group/i,
  /changed this group/i,
  /changed the subject/i,
  /changed the icon/i,
  /deleted this message/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /security code changed/i,
];

export function parseDateString(dateStr: string, timeStr: string): Date | null {
  try {
    const cleanDate = dateStr.trim();
    const cleanTime = timeStr.trim();

    // Split date parts (supports /, ., -)
    const dateParts = cleanDate.split(/[\/\.\-]/).map((p) => parseInt(p, 10));
    if (dateParts.length < 3) return null;

    let day = dateParts[0];
    let month = dateParts[1];
    let year = dateParts[2];

    // Normalize 2-digit year (e.g. 24 -> 2024)
    if (year < 100) {
      year += 2000;
    }

    // Handle MM/DD vs DD/MM guessing: if month > 12, swap
    if (month > 12 && day <= 12) {
      const temp = month;
      month = day;
      day = temp;
    }

    // Parse time
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    const isPM = /pm/i.test(cleanTime);
    const isAM = /am/i.test(cleanTime);

    const timeNumbers = cleanTime
      .replace(/[^\d:]/g, '')
      .split(':')
      .map((t) => parseInt(t, 10));

    if (timeNumbers.length >= 2) {
      hours = timeNumbers[0];
      minutes = timeNumbers[1];
      if (timeNumbers.length >= 3) {
        seconds = timeNumbers[2];
      }

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }

    const resultDate = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(resultDate.getTime()) ? null : resultDate;
  } catch {
    return null;
  }
}
