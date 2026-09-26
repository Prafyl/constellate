/** Turns the things people actually study from (Wikipedia pages, PDFs, notes) into plain text. */

export interface Document { title: string; text: string; source?: string }

/** Accepts a Wikipedia URL (any language) or just an article title. */
export async function fromWikipedia(input: string): Promise<Document> {
  let lang = 'en';
  let title = input.trim();
  const m = title.match(/^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i);
  if (m) { lang = m[1]; title = decodeURIComponent(m[2]); }
  title = title.replace(/_/g, ' ');

  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(title)}`;
  const page = (await (await fetch(api)).json()).query?.pages?.[0];
  if (!page || page.missing || !page.extract) throw new Error(`Couldn't find a Wikipedia article called “${title}”.`);

  // Drop reference-only sections at the end.
  const text = (page.extract as string).split(/\n==\s*(See also|References|Notes|Further reading|External links|Sources|Bibliography)\s*==/)[0];
  return { title: page.title, text, source: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
}

/** Reads .txt, .md or .pdf files entirely in the browser. */
export async function fromFile(file: File): Promise<Document> {
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return { title, text: await readPdf(file), source: file.name };
  return { title, text: await file.text(), source: file.name };
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; } else line += item.str.endsWith(' ') ? '' : ' ';
    }
    lines.push(line);
    // Re-join hard-wrapped lines into paragraphs; keep short standalone lines (headings) on their own.
    pages.push(lines.map((l) => l.trim()).join('\n').replace(/([a-z,;])\n(?=[a-z])/g, '$1 ').replace(/-\n(?=[a-z])/g, ''));
  }
  const text = pages.join('\n');
  if (text.replace(/\s/g, '').length < 200) throw new Error('This PDF has no selectable text (it may be a scanned image).');
  return text;
}
