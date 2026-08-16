import JSZip from 'jszip';

export interface ExtractedChat {
  text: string;
  fileName: string;
}

/**
 * Extracts raw WhatsApp text from a .txt or .zip file.
 * Handles official WhatsApp mobile export archives (.zip) automatically.
 */
export async function extractChatFile(file: File): Promise<ExtractedChat> {
  const isZip = 
    file.name.toLowerCase().endsWith('.zip') || 
    file.type === 'application/zip' || 
    file.type === 'application/x-zip-compressed';

  if (isZip) {
    const zip = await JSZip.loadAsync(file);
    const textFiles = Object.keys(zip.files).filter(filename => 
      !zip.files[filename].dir && filename.toLowerCase().endsWith('.txt')
    );

    if (textFiles.length === 0) {
      throw new Error('No .txt chat export found inside this .zip file. Please ensure it is a WhatsApp export.');
    }

    // Prefer _chat.txt (iOS/Android WhatsApp default) or pick the first text file
    const targetFile = textFiles.find(name => name.toLowerCase().includes('_chat.txt')) || textFiles[0];
    const text = await zip.files[targetFile].async('string');
    return { text, fileName: targetFile };
  }

  const text = await file.text();
  return { text, fileName: file.name };
}
