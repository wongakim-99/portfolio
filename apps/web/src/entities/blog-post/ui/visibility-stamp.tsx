import { cx } from '@shared/lib';
import { VISIBILITY_LABEL, type Visibility } from '../model/types';
import './blog-post.css';

/** 글 제목 옆 도장. 잠긴 글이면 '잠김', 주인장에게는 공개 범위를 찍어 보여 줌 */
export function VisibilityStamp({ visibility, locked = false }: { visibility: Visibility; locked?: boolean }) {
  if (visibility === 'public' && !locked) return null;
  return <span className={cx('blog-stamp', `blog-stamp-${locked ? 'locked' : visibility}`)}>{locked ? '잠김' : VISIBILITY_LABEL[visibility]}</span>;
}
