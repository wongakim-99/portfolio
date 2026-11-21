import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cx } from '@shared/lib';
import './sheet.css';

type SheetProps<T extends ElementType> = {
  as?: T;
  /** 종이 위쪽에 검은 집게를 그림 */
  clip?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

export function Sheet<T extends ElementType = 'section'>({ as, clip = false, className, children, ...rest }: SheetProps<T>) {
  const Tag: ElementType = as ?? 'section';
  return (
    <Tag className={cx('sheet', className)} {...rest}>
      {clip && <span className="clip" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
