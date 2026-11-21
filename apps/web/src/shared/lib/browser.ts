// 브라우저에서만 부르는 작은 도우미

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 파일을 내려받게 함. 숨은 터미널의 pdf 명령처럼 링크를 누르지 않고 받을 때 씀 */
export function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}
