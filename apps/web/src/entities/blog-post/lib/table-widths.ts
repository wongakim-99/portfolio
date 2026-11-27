// 표 칸 너비를 마크다운에 남기는 꼴. 마크다운 표에는 너비를 적을 자리가 없어서 표 바로 위 줄에 HTML 주석으로 둠
// <!-- widths: 120 300 160 --> 처럼 칸마다 px. 다른 마크다운 화면에서는 주석이라 보이지 않음
// 글쓰기 편집기(features/write-blog-post)가 쓰고 읽고, 읽는 화면(rehype-table-widths)이 그 너비대로 그림

const TABLE_WIDTHS = /^<!--\s*widths:\s*(\d+(?:\s+\d+)*)\s*-->$/;

/** 주석 한 줄에서 칸 너비(px)를 꺼냄. 너비 주석이 아니면 null */
export function parseTableWidths(line: string): number[] | null {
  const match = TABLE_WIDTHS.exec(line.trim());
  return match ? match[1]!.split(/\s+/).map(Number) : null;
}

export const tableWidthsComment = (widths: number[]) => `<!-- widths: ${widths.map((width) => Math.round(width)).join(' ')} -->`;
