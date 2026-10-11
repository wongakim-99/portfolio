// PDF 생성기가 index.html 구조 변경으로 조용히 깨지지 않는지 확인함
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parse } from 'node-html-parser';
import { extractPortfolio, HTML_PATH, renderPdf } from './portfolio-pdf.mjs';

// 이력서 문체 규칙: 가운뎃점, em dash, 수학 마이너스, 검은 사각형은 AI 티가 나서 쓰지 않음
const FORBIDDEN = /[■·—−]/;

let html;
let data;
before(async () => {
  html = await readFile(HTML_PATH, 'utf8');
  data = extractPortfolio(html);
});

describe('index.html 에서 내용 꺼내기', () => {
  it('머리와 섹션이 모두 채워짐', () => {
    assert.equal(data.name, '김가원');
    assert.match(data.email, /@/);
    assert.match(data.github, /^https:\/\/github\.com\//);
    assert.match(data.site, /^https:\/\//);
    assert.equal(data.about.length, 3);
    assert.ok(data.work.length >= 1);
    assert.ok(data.projects.length >= 4);
    assert.equal(data.skills.length, 4);
    assert.ok(data.history.length >= 5);
  });

  it('각 항목에 제목, 기간, 내용이 있음', () => {
    for (const item of [...data.work, ...data.projects]) {
      assert.ok(item.title && item.period, JSON.stringify(item));
      assert.ok(item.points.length > 0, `${item.title} 의 내용이 비어 있음`);
      assert.ok(item.stack.length > 0, `${item.title} 의 기술이 비어 있음`);
    }
    for (const group of data.skills) assert.ok(group.items.length > 0, group.label);
  });

  it('이론상 수치라는 단서가 PDF 에서도 빠지지 않음', () => {
    const point = data.work[0].points.find((p) => p.includes('21초'));
    assert.ok(point?.includes('(이론상 비교)'), point);
  });

  it('이력의 비고는 본문과 나뉨', () => {
    const course = data.history.find((h) => h.what.includes('유레카'));
    assert.equal(course.note, '멀티캠퍼스');
    assert.ok(!course.what.includes('멀티캠퍼스'));
  });

  it('페이지에 보이는 글자에 금지 문자가 없음', () => {
    const root = parse(html);
    root.querySelectorAll('script, style').forEach((el) => el.remove());
    const visible = root.querySelector('body').text;
    assert.doesNotMatch(visible, FORBIDDEN);
    assert.doesNotMatch(JSON.stringify(data), FORBIDDEN);
  });
});

describe('PDF 만들기', () => {
  let dir;
  before(async () => (dir = await mkdtemp(path.join(os.tmpdir(), 'portfolio-pdf-'))));
  after(async () => rm(dir, { recursive: true, force: true }));

  it('A4 두 쪽 안에 들어가는 PDF 를 만듦', async () => {
    const out = path.join(dir, 'out.pdf');
    const { pages } = await renderPdf(data, out, { generatedAt: new Date('2026-10-11T00:00:00Z') });
    const pdf = await readFile(out);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pages >= 1 && pages <= 2, `${pages}쪽`);
    // 글꼴은 쓴 글자만 넣으므로 수백 KB 를 넘으면 뭔가 잘못된 것
    assert.ok(pdf.length > 10_000 && pdf.length < 500_000, `${pdf.length} bytes`);
  });

  it('data-pdf 표시가 빠지면 조용히 넘어가지 않고 실패함', () => {
    assert.throws(() => extractPortfolio('<html><body><h1>no marks</h1></body></html>'), /data-pdf/);
  });
});
