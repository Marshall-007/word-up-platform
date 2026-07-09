// Best-effort in-browser document validation. Mirrors the backend's intent:
// a real document with readable text, not empty / scanned images / gibberish.
//
// Reading exact glyphs from an arbitrary PDF in the browser is unreliable
// (fonts, encodings), so for PDFs we detect whether a real TEXT LAYER exists
// (text-showing operators) rather than trying to decode every character. The
// real FastAPI backend (pypdf) does full text extraction + quality checks.
import pako from 'pako';

function bytesToLatin1(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return s;
}

// Concatenate the PDF's content, inflating FlateDecode streams so text
// operators inside compressed content streams are visible.
function pdfInflatedContent(bytes) {
  const raw = bytesToLatin1(bytes);
  let combined = raw;
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const header = raw.slice(Math.max(0, m.index - 400), m.index);
    if (/FlateDecode/.test(header)) {
      try {
        const body = m[1];
        const arr = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) arr[i] = body.charCodeAt(i) & 0xff;
        combined += '\n' + bytesToLatin1(pako.inflate(arr));
      } catch (e) {
        /* ignore streams we cannot inflate */
      }
    }
  }
  return combined;
}

// True if the PDF has a real text layer (BT/ET blocks with Tj/TJ show ops).
// A scanned / image-only PDF draws images (Do) but shows no text.
export function pdfHasTextLayer(bytes) {
  try {
    const content = pdfInflatedContent(bytes);
    const showOps = (content.match(/T[jJ]/g) || []).length;
    const blocks = (content.match(/BT\s/g) || []).length;
    return showOps >= 3 || (blocks >= 1 && showOps >= 1);
  } catch (e) {
    return false;
  }
}

// Best-effort readable-text extraction for a PDF (used only for a preview,
// never to reject — it garbles many real PDFs by design of the format).
export function extractPdfText(bytes) {
  const content = pdfInflatedContent(bytes);
  let out = '';
  const litRe = /\(((?:[^()\\]|\\.)*)\)\s*T[jJ]/g;
  let lm;
  while ((lm = litRe.exec(content)) !== null) {
    out += lm[1].replace(/\\([nrtbf()\\])/g, ' ').replace(/\\[0-9]{1,3}/g, ' ') + ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function extractTxtText(bytes) {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return bytesToLatin1(bytes);
  }
}

// Lenient readable-language check for plain text. Kept in sync with the
// backend's assess_text_quality thresholds.
export function assessTextQuality(text, ext) {
  const stripped = (text || '').trim();
  const scannedHint =
    ext === '.pdf'
      ? ' It may be a scanned image or password-protected PDF. Please upload a PDF with selectable text.'
      : '';
  if (stripped.length < 100) {
    return {
      ok: false,
      reason:
        'The document has too little readable text. Upload a document with real written content (a paragraph or more).' +
        scannedHint,
    };
  }
  const words = stripped.match(/[A-Za-z]{2,}/g) || [];
  if (words.length < 20) {
    return { ok: false, reason: 'Not enough readable words were found in the document.' + scannedHint };
  }
  const vowelWords = words.filter((w) => /[aeiou]/i.test(w));
  if (vowelWords.length / words.length < 0.5) {
    return {
      ok: false,
      reason: 'The document text does not look like readable writing (it may be random characters or images).',
    };
  }
  const distinct = new Set(words.map((w) => w.toLowerCase())).size;
  if (distinct < 10) {
    return { ok: false, reason: 'The document does not contain enough distinct words.' };
  }
  return { ok: true, text: stripped };
}
