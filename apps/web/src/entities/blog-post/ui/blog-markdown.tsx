'use client';

import { useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { remarkCallout } from '../lib/remark-callout';
import './blog-markdown.css';

// 블로그 본문 마크다운. 노션에서 쓰던 제목, 목록, 체크리스트, 표, 코드, 인용, 콜아웃, 사진을 그대로 그림
// 글 안의 HTML 은 그리지 않고(react-markdown 기본), 링크 주소의 javascript: 같은 것도 걸러짐
// 줄바꿈은 쓴 그대로 살림(remark-breaks). 예전에 줄글로 쓴 글도 줄이 붙지 않음

interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
  properties?: Record<string, unknown>;
}

const textOf = (node?: HastNode): string => (node?.type === 'text' ? (node.value ?? '') : (node?.children ?? []).map(textOf).join(''));

function CodeBlock({ node, children }: { node?: HastNode; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = node?.children?.find((child) => child.type === 'element');
  const classes = (code?.properties?.className as string[] | undefined) ?? [];
  const language = classes.find((name) => name.startsWith('language-'))?.slice('language-'.length);

  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf(code).replace(/\n$/, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 복사를 못 하는 브라우저면 그냥 둠
    }
  }

  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{language ?? 'text'}</span>
        <button type="button" onClick={copy}>
          {copied ? '복사함' : '복사'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

// 글 제목이 h1 이라 본문의 # 은 한 단계 아래 제목으로 그림
const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="md-h1">{children}</h2>,
  h2: ({ children }) => <h3 className="md-h2">{children}</h3>,
  h3: ({ children }) => <h4 className="md-h3">{children}</h4>,
  h4: ({ children }) => <h5 className="md-h4">{children}</h5>,
  a: ({ href, children }) => {
    const external = Boolean(href && /^https?:\/\//.test(href));
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  },
  // 문단 안에 들어가므로 figure 대신 span 으로 감쌈. 제목(따옴표 안 글)이 있으면 사진 아래 캡션으로
  img: ({ src, alt, title }) => {
    if (typeof src !== 'string' || !src) return null;
    return (
      <span className="md-figure">
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`${alt || '사진'} 크게 보기`}>
          {/* 글 사진은 API 가 줄여 둔 파일이라 next/image 최적화를 거치지 않음 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" />
        </a>
        {title && <span className="md-caption">{title}</span>}
      </span>
    );
  },
  table: ({ children }) => (
    <div className="md-table">
      <table>{children}</table>
    </div>
  ),
  pre: ({ node, children }) => <CodeBlock node={node as HastNode | undefined}>{children}</CodeBlock>,
  aside: ({ node, children }) => (
    <aside className="md-callout">
      <span className="md-callout-icon" aria-hidden="true">
        {String((node as HastNode | undefined)?.properties?.dataIcon ?? '')}
      </span>
      <div>{children}</div>
    </aside>
  ),
};

export function BlogMarkdown({ source }: { source: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkCallout]} rehypePlugins={[rehypeHighlight]} components={COMPONENTS}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
