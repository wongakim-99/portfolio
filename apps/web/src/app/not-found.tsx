import Link from 'next/link';
import { routes } from '@shared/config';
import { Sheet } from '@shared/ui';
import { SiteFooter } from '@widgets/site-footer';
import { SiteHeader } from '@widgets/site-header';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="not-found" id="main">
        <Sheet clip>
          <p className="hand">여기는 비어 있어요</p>
          <h1>페이지를 찾을 수 없습니다</h1>
          <p>주소가 바뀌었거나 지워진 페이지입니다.</p>
          <Link className="tape" href={routes.home}>
            홈으로 가기
          </Link>
        </Sheet>
      </main>
      <SiteFooter />
    </>
  );
}
