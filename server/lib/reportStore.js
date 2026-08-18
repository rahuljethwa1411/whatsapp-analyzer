/**
 * Report Persistence Store
 * Safely saves generated report snapshots so paying users can retrieve their
 * 6-page dossier and download their PDF from any device or days later via email link.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.resolve(__dirname, '../../server/data/reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  } catch (err) {
    console.warn('[ReportStore] Could not create reports directory:', err.message);
  }
}

/**
 * Saves a completed report snapshot for a verified payment.
 */
export function saveReportSnapshot(paymentId, reportData) {
  if (!paymentId || !reportData) return false;
  try {
    const filePath = path.join(REPORTS_DIR, `${paymentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(reportData), 'utf8');
    console.log(`[ReportStore] 💾 Saved report snapshot for payment ${paymentId}`);
    return true;
  } catch (err) {
    console.error(`[ReportStore] Failed to save report snapshot for ${paymentId}:`, err.message);
    return false;
  }
}

/**
 * Retrieves a saved report snapshot by payment ID.
 */
export function getReportSnapshot(paymentId) {
  if (!paymentId) return null;
  try {
    const filePath = path.join(REPORTS_DIR, `${paymentId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[ReportStore] Failed to read report snapshot for ${paymentId}:`, err.message);
  }
  return null;
}
