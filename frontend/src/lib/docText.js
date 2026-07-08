// Best-effort in-browser document text extraction + content-quality check.
// Mirrors the backend's validation so the demo enforces "a real document with
// readable content" (not empty, scanned images, or random characters).
import pako from 'pako';

function bytesToLatin1(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return s;
}

// Pull readable text out of a PDF: inflate FlateDecode streams, then read the
// string operands of text-showing operators.
export function extractPdfText(bytes) {
  const raw = bytesToLatin1(bytes);
  let combined = '';

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  let foundStream = false;
  while ((m = streamRe.exec(raw)) !== null) {
    foundStream = true;
    const header = raw.slice(Math.max(0, m.index - 400), m.index);
    const body = m[1];
    let decoded = body;
    if (/FlateDecode/.test(header)) {
      try {
        const arr = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) arr[i] = body.charCodeAt(i) & 0xff;
        decoded = bytesToLatin1(pako.inflate(arr));
      } catch (e) {
        decoded = '';
      }
    }
    combined += '\n' + decoded;
  }
  if (!foundStream) combined = raw;

  // Text strings appear as (literal) Tj / [..] TJ, and <hex> strings.
  let out = '';
  const litRe = /\(((?:[^()\\]|\\.)*)\)/g;
  let lm;
  while ((lm = litRe.exec(combined)) !== null) {
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

// Returns { ok: true } or { ok: false, reason }. Keep messages in sync with the
// backend's assess_text_quality.
export function assessTextQuality(text, ext) {
  const stripped = (text || '').trim();
  const scannedHint =
    ext === '.pdf'
      ? ' It may be a scanned image or password-protected PDF. Please upload a PDF with selectable text.'
      : '';
  if (stripped.length < 200) {
    return {
      ok: false,
      reason:
        'The document has too little readable text. Upload a document with real written content (at least a few paragraphs).' +
        scannedHint,
    };
  }
  const words = stripped.match(/[A-Za-z]{2,}/g) || [];
  if (words.length < 50) {
    return { ok: false, reason: 'Not enough readable words were found in the document.' + scannedHint };
  }
  const vowelWords = words.filter((w) => /[aeiou]/i.test(w));
  if (vowelWords.length / words.length < 0.55) {
    return {
      ok: false,
      reason: 'The document text does not look like readable writing (it may be random characters or images).',
    };
  }
  const avg = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avg < 2.2 || avg > 14) {
    return { ok: false, reason: 'The document text does not look like readable writing.' };
  }
  const distinct = new Set(words.map((w) => w.toLowerCase())).size;
  if (distinct < 20) {
    return { ok: false, reason: 'The document does not contain enough distinct words.' };
  }
  return { ok: true, text: stripped };
}
