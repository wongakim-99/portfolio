import { youtubeIdIn } from '@shared/lib';

/** 마크다운을 그릴 때 받는 문단 노드(hast) 가운데 여기서 보는 것만 */
export interface ParagraphNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: ParagraphNode[];
}

/**
 * 문단에 유튜브 링크 하나만 있으면 그 영상 ID. 문장 중간에 섞인 링크는 글자 링크로 두려고 null
 * 링크 글자는 주소든 [제목](주소)든 상관없고, 앞뒤 빈칸과 줄바꿈은 없는 것으로 봄
 */
export function loneVideoId(paragraph?: ParagraphNode): string | null {
  const parts = (paragraph?.children ?? []).filter(
    (child) => !(child.type === 'text' && !child.value?.trim()) && !(child.type === 'element' && child.tagName === 'br'),
  );
  const link = parts.length === 1 ? parts[0] : undefined;
  if (link?.type !== 'element' || link.tagName !== 'a') return null;
  const href = link.properties?.href;
  return typeof href === 'string' ? youtubeIdIn(href) : null;
}
