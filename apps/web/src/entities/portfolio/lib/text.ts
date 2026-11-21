import type { RichText } from '../model/content';

/** 터미널처럼 글자만 필요한 곳에서 씀 */
export function plainText(value: RichText) {
  if (typeof value === 'string') return value;
  return value.map((part) => (typeof part === 'string' ? part : 'mark' in part ? part.mark : part.pen)).join('');
}

/** https://github.com/wongakim-99 → github.com/wongakim-99 */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
