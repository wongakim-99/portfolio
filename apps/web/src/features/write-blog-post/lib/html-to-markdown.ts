// 노션이나 다른 웹 글을 복사해 붙이면 HTML 로 들어옴. 제목, 목록, 표, 코드, 굵게를 마크다운으로 바꿔 넣음
// 변환기(turndown)는 붙여넣을 때만 불러와서 글쓰기 화면을 처음 여는 속도에 영향이 없게 함

// 구조가 있는 HTML 만 바꿈. VS Code 처럼 글자 색만 입힌 HTML 은 그냥 글자로 붙임
const STRUCTURE = /<(?:h[1-6]|ul|ol|li|table|blockquote|pre|img|strong|b|em|a)\b/i;

export const looksStructured = (html: string) => STRUCTURE.test(html);

// 노션 사진 주소는 시간이 지나면 막히는 임시 주소라, 그대로 두면 나중에 깨진 사진이 됨. 다시 올리라는 콜아웃으로 바꿈
const EXPIRING_IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)\s]*(?:notion-static\.com|notion\.so\/image|amazonaws\.com|notionusercontent\.com)[^)\s]*)[^)]*\)/g;
export const REUPLOAD_NOTE = '> 📷 이 자리에 사진을 다시 올려 주세요 (노션 사진 주소는 시간이 지나면 막힘)';

export async function htmlToMarkdown(html: string): Promise<{ markdown: string; dropped: number }> {
  const [{ default: TurndownService }, { gfm }] = await Promise.all([import('turndown'), import('turndown-plugin-gfm')]);
  const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**' });
  service.use(gfm);
  // 코드 블록의 언어(class="language-ts")를 울타리 뒤에 붙임
  service.addRule('fencedLanguage', {
    filter: (node) => node.nodeName === 'PRE' && Boolean(node.firstElementChild && node.firstElementChild.nodeName === 'CODE'),
    replacement: (_content, node) => {
      const code = (node as HTMLElement).firstElementChild as HTMLElement;
      const language = /language-([\w+#-]+)/.exec(code.className)?.[1] ?? '';
      return `\n\n\`\`\`${language}\n${code.textContent?.replace(/\n$/, '') ?? ''}\n\`\`\`\n\n`;
    },
  });
  let dropped = 0;
  const markdown = service
    .turndown(html)
    .replace(EXPIRING_IMAGE, () => {
      dropped += 1;
      return `\n\n${REUPLOAD_NOTE}\n\n`;
    })
    // turndown 은 목록 기호 뒤에 공백을 세 칸 두어서 한 칸으로 맞춤
    .replace(/^(\s*)([-*+]|\d+\.) {2,}/gm, '$1$2 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { markdown, dropped };
}
