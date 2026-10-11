// apps/web/index.html 의 data-pdf 표시를 읽어 포트폴리오 PDF 를 만듦
// 내용은 페이지 한곳에서만 고치면 되도록 HTML 을 원본으로 씀
// 배포 때 홈서버 runner 가 실행하므로 브라우저 없이 pdfkit 으로 직접 그림
import { createWriteStream } from 'node:fs';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { parse } from 'node-html-parser';
import PDFDocument from 'pdfkit';

const ROOT = new URL('../', import.meta.url);
export const HTML_PATH = fileURLToPath(new URL('apps/web/index.html', ROOT));
export const PDF_PATH = fileURLToPath(new URL('apps/web/gawon-portfolio.pdf', ROOT));
const FONTS = {
  regular: fileURLToPath(new URL('scripts/fonts/IBMPlexSansKR-Regular.woff', ROOT)),
  semibold: fileURLToPath(new URL('scripts/fonts/IBMPlexSansKR-SemiBold.woff', ROOT)),
  bold: fileURLToPath(new URL('scripts/fonts/IBMPlexSansKR-Bold.woff', ROOT)),
};

const COLOR = { ink: '#15181c', soft: '#59616a', rule: '#d9dde1', link: '#2340c2', marker: '#ffe55c', award: '#d6352b' };
const MARGIN = { top: 52, bottom: 60, left: 56, right: 56 };
// fi, fl 합자를 쓰면 복사하거나 채용 사이트가 글자를 읽을 때 'Airflow' 가 'Airfow' 로 깨짐
const NO_LIGATURES = { liga: false, clig: false, dlig: false };
const opts = (options = {}) => ({ features: NO_LIGATURES, ...options });

/* HTML 에서 내용 꺼내기 */

const clean = (text) => text.replace(/\s+/g, ' ').trim();
const textOf = (el) => (el ? clean(el.text) : '');

function required(value, what) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`index.html 에서 ${what} 을(를) 찾지 못함. data-pdf 표시를 확인할 것`);
  }
  return value;
}

function entry(el) {
  const pick = (key) => el.querySelector(`[data-pdf="${key}"]`);
  return {
    title: required(textOf(pick('title')), 'title'),
    period: required(textOf(pick('period')), 'period'),
    award: textOf(pick('award')),
    role: textOf(pick('role')),
    desc: textOf(pick('desc')),
    points: pick('points')?.querySelectorAll('li').map(textOf) ?? [],
    stack: pick('stack')?.querySelectorAll('li').map(textOf) ?? [],
    link: pick('link')?.getAttribute('href') ?? '',
  };
}

export function extractPortfolio(html) {
  const root = parse(html);
  const one = (key) => root.querySelector(`[data-pdf="${key}"]`);
  const all = (key, base = root) => base.querySelectorAll(`[data-pdf="${key}"]`);

  const history = all('when').map((when) => {
    const li = when.parentNode;
    const what = li.querySelector('[data-pdf="what"]');
    const note = what?.querySelector('[data-pdf="note"]');
    const noteText = textOf(note);
    note?.remove();
    return { when: textOf(when), what: textOf(what), note: noteText };
  });

  return {
    name: required(textOf(one('name')), 'name'),
    lead: required(textOf(one('lead')), 'lead'),
    email: required(textOf(one('email')), 'email'),
    github: required(one('github')?.getAttribute('href'), 'github'),
    site: root.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
    about: required(
      all('about-item').map((item) => ({ label: textOf(item.querySelector('[data-pdf="label"]')), text: textOf(item.querySelector('[data-pdf="text"]')) })),
      'about',
    ),
    work: required(all('work').map(entry), 'work'),
    projects: required(all('project').map(entry), 'project'),
    skills: required(
      all('skill-group').map((group) => ({
        label: textOf(group.querySelector('[data-pdf="label"]')),
        items: group.querySelectorAll('[data-pdf="items"] li').map(textOf),
      })),
      'skills',
    ),
    history: required(history, 'history'),
  };
}

/* PDF 그리기 */

// pdfkit 이 WOFF 를 직접 풀면 순수 JS inflate 라 16초쯤 걸림. zlib 으로 TTF 로 풀어서 넘김
export function woffToSfnt(woff) {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') return woff;
  const numTables = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const offset = woff.readUInt32BE(at + 4);
    const compLength = woff.readUInt32BE(at + 8);
    const origLength = woff.readUInt32BE(at + 12);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({
      tag: woff.subarray(at, at + 4),
      checksum: woff.readUInt32BE(at + 16),
      data: compLength < origLength ? inflateSync(raw) : raw,
    });
  }
  const pad = (n) => (n + 3) & ~3;
  const headerSize = 12 + numTables * 16;
  const out = Buffer.alloc(headerSize + tables.reduce((sum, t) => sum + pad(t.data.length), 0));
  const log2 = Math.floor(Math.log2(numTables));
  out.writeUInt32BE(woff.readUInt32BE(4), 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(2 ** log2 * 16, 6);
  out.writeUInt16BE(log2, 8);
  out.writeUInt16BE(numTables * 16 - 2 ** log2 * 16, 10);
  let offset = headerSize;
  tables.forEach((table, i) => {
    const at = 12 + i * 16;
    table.tag.copy(out, at);
    out.writeUInt32BE(table.checksum, at + 4);
    out.writeUInt32BE(offset, at + 8);
    out.writeUInt32BE(table.data.length, at + 12);
    table.data.copy(out, offset);
    offset += pad(table.data.length);
  });
  return out;
}

const stripScheme = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

function kstDate(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}.${parts.month}.${parts.day}`;
}

class Layout {
  constructor(doc) {
    this.doc = doc;
    this.x = MARGIN.left;
    this.width = doc.page.width - MARGIN.left - MARGIN.right;
  }

  get bottom() {
    return this.doc.page.height - MARGIN.bottom;
  }

  style(font, size, color = COLOR.ink) {
    this.doc.font(font).fontSize(size).fillColor(color);
    return this;
  }

  height(text, font, size, width, lineGap = 2) {
    this.doc.font(font).fontSize(size);
    return this.doc.heightOfString(text, opts({ width, lineGap }));
  }

  // 남은 공간이 모자라면 다음 쪽으로 넘김
  ensure(space) {
    if (this.doc.y + space > this.bottom) {
      this.doc.addPage();
      this.doc.y = MARGIN.top;
    }
  }

  text(text, { font = 'regular', size = 9.5, color = COLOR.ink, indent = 0, gap = 0, lineGap = 2, link } = {}) {
    this.style(font, size, color);
    this.doc.text(text, this.x + indent, this.doc.y, opts({ width: this.width - indent, lineGap, link, underline: false }));
    this.doc.y += gap;
  }

  sectionTitle(title) {
    this.ensure(70);
    this.doc.y += 8;
    const y = this.doc.y;
    this.style('bold', 13);
    const w = this.doc.widthOfString(title, opts());
    // 웹 페이지의 형광펜 표시를 PDF 에도 옮김
    this.doc.rect(this.x - 2, y + 9, w + 4, 7).fill(COLOR.marker);
    this.style('bold', 13).doc.text(title, this.x, y, opts({ lineBreak: false }));
    this.doc.y = y + 24;
  }

  entryHeight(item) {
    const w = this.width;
    let h = this.height(item.title, 'bold', 11.5, w - 110) + 4;
    if (item.award) h += this.height(item.award, 'semibold', 8.8, w) + 1;
    if (item.role) h += this.height(item.role, 'regular', 9, w) + 3;
    if (item.desc) h += this.height(item.desc, 'regular', 9.5, w) + 3;
    for (const point of item.points) h += this.height(point, 'regular', 9.3, w - 11, 1.6) + 1.5;
    if (item.stack.length) h += this.height(`Tech: ${item.stack.join(', ')}`, 'regular', 8.5, w) + 5;
    if (item.link) h += 14;
    return h + 13;
  }

  entry(item) {
    // 한 항목이 두 쪽으로 갈라지지 않게 통째로 재서 넘김
    this.ensure(Math.min(this.entryHeight(item), this.bottom - MARGIN.top));
    const { doc } = this;
    const y = doc.y;
    this.style('regular', 8.8, COLOR.soft);
    doc.text(item.period, this.x, y + 2.5, opts({ width: this.width, align: 'right', lineBreak: false }));
    this.style('bold', 11.5);
    doc.text(item.title, this.x, y, opts({ width: this.width - 110, lineGap: 1 }));
    doc.y += 2;
    if (item.award) this.text(item.award, { font: 'semibold', size: 8.8, color: COLOR.award, gap: 1 });
    if (item.role) this.text(item.role, { size: 9, color: COLOR.soft, gap: 3 });
    if (item.desc) this.text(item.desc, { size: 9.5, gap: 3 });
    for (const point of item.points) {
      const top = doc.y;
      this.style('regular', 9.3, COLOR.soft);
      doc.text('-', this.x + 1, top, opts({ lineBreak: false }));
      doc.y = top;
      this.text(point, { size: 9.3, indent: 11, gap: 1.5, lineGap: 1.6 });
    }
    if (item.stack.length) {
      doc.y += 3;
      this.text(`Tech: ${item.stack.join(', ')}`, { size: 8.5, color: COLOR.soft, gap: 2 });
    }
    if (item.link) this.text(stripScheme(item.link), { size: 8.5, color: COLOR.link, link: item.link });
    doc.y += 14;
  }

  labelRows(rows, labelWidth) {
    for (const { label, text, note } of rows) {
      const body = note ? `${text}  ${note}` : text;
      const h = Math.max(this.height(body, 'regular', 9.5, this.width - labelWidth), this.height(label, 'semibold', 9.5, labelWidth - 8));
      this.ensure(h + 5);
      const y = this.doc.y;
      this.style('semibold', 9.5);
      this.doc.text(label, this.x, y, opts({ width: labelWidth - 8, lineGap: 2 }));
      this.style('regular', 9.5);
      this.doc.text(text, this.x + labelWidth, y, opts({ width: this.width - labelWidth, lineGap: 2, continued: Boolean(note) }));
      if (note) this.style('regular', 8.8, COLOR.soft).doc.text(`  ${note}`, opts({ lineGap: 2 }));
      this.doc.y = y + h + 5;
    }
  }
}

export function renderPdf(data, outPath, { generatedAt = new Date() } = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: MARGIN,
    bufferPages: true,
    lang: 'ko-KR',
    displayTitle: true,
    info: {
      Title: `${data.name} 포트폴리오`,
      Author: data.name,
      Subject: data.lead,
      CreationDate: generatedAt,
      ModDate: generatedAt,
    },
  });
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, woffToSfnt(readFileSync(file)));
  const stream = createWriteStream(outPath);
  doc.pipe(stream);

  const page = new Layout(doc);

  // 머리: 이름, 한 줄 소개, 연락처
  doc.y = MARGIN.top;
  page.text(data.name, { font: 'bold', size: 28, gap: 2, lineGap: 0 });
  page.text(data.lead, { size: 11.5, color: COLOR.soft, gap: 8 });
  const contacts = [
    { text: data.email, link: `mailto:${data.email}` },
    { text: stripScheme(data.github), link: data.github },
    ...(data.site ? [{ text: stripScheme(data.site), link: data.site }] : []),
  ];
  page.style('regular', 9, COLOR.link);
  let cx = page.x;
  const cy = doc.y;
  for (const [i, contact] of contacts.entries()) {
    if (i > 0) {
      page.style('regular', 9, COLOR.rule);
      doc.text('|', cx, cy, opts({ lineBreak: false }));
      cx += doc.widthOfString('|', opts()) + 8;
      page.style('regular', 9, COLOR.link);
    }
    doc.text(contact.text, cx, cy, opts({ link: contact.link, lineBreak: false }));
    cx += doc.widthOfString(contact.text, opts()) + 8;
  }
  doc.y = cy + 20;
  doc.moveTo(page.x, doc.y).lineTo(page.x + page.width, doc.y).lineWidth(0.8).strokeColor(COLOR.rule).stroke();
  doc.y += 6;

  page.sectionTitle('소개');
  page.labelRows(data.about.map(({ label, text }) => ({ label, text })), 64);

  page.sectionTitle('경력');
  data.work.forEach((item) => page.entry(item));

  page.sectionTitle('프로젝트');
  data.projects.forEach((item) => page.entry(item));

  page.sectionTitle('기술');
  page.labelRows(data.skills.map(({ label, items }) => ({ label, text: items.join(', ') })), 78);

  page.sectionTitle('이력');
  page.labelRows(data.history.map(({ when, what, note }) => ({ label: when, text: what, note })), 108);

  // 쪽 번호와 기준일
  const range = doc.bufferedPageRange();
  const footer = `${kstDate(generatedAt)} 기준${data.site ? `, 최신본은 ${stripScheme(data.site)}` : ''}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGIN.bottom + 26;
    doc.page.margins.bottom = 0;
    page.style('regular', 7.8, COLOR.soft);
    doc.text(footer, page.x, y, opts({ lineBreak: false }));
    doc.text(`${i + 1} / ${range.count}`, page.x, y, opts({ width: page.width, align: 'right', lineBreak: false }));
    doc.page.margins.bottom = MARGIN.bottom;
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ pages: range.count }));
    stream.on('error', reject);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = extractPortfolio(await readFile(HTML_PATH, 'utf8'));
  const { pages } = await renderPdf(data, PDF_PATH);
  console.log(`[pdf] ${PDF_PATH} (${pages}쪽)`);
}
