// 글이 없을 때 빈 자리에 놓는 그림. 책상 위에 테이프로 붙인 빈 종이 한 장, 옆에 굴러다니는 연필, '곧 채울게요' 포스트잇, 커피 자국
// 색은 모두 토큰이라 스탠드를 꺼도(어두운 화면) 책상 위 물건처럼 보임. 글자는 아래 문장이 맡고 그림은 꾸밈이라 읽지 않음
export function EmptyDesk() {
  return (
    <svg className="empty-desk" viewBox="0 0 260 180" aria-hidden="true">
      {/* 커피잔 자국 */}
      <circle className="empty-desk-ring" cx="214" cy="40" r="22" />
      <circle className="empty-desk-ring is-faint" cx="216" cy="42" r="19" />
      {/* 빈 종이: 줄만 그어 둔 채 비어 있음 */}
      <g transform="rotate(-4 130 92)">
        <rect className="empty-desk-paper" x="74" y="22" width="112" height="140" rx="2" />
        {[52, 66, 80, 94, 108, 122, 136].map((y) => (
          <line key={y} className="empty-desk-rule" x1="86" x2="174" y1={y} y2={y} />
        ))}
        <line className="empty-desk-margin" x1="96" x2="96" y1="30" y2="154" />
        {/* 위쪽 마스킹 테이프 */}
        <rect className="empty-desk-tape" x="112" y="14" width="38" height="14" rx="1.5" transform="rotate(3 131 21)" />
      </g>
      {/* 연필: 지우개, 쇠테, 몸통, 깎은 나무, 심 */}
      <g transform="rotate(-28 186 138)">
        <rect className="empty-desk-eraser" x="140" y="132" width="10" height="12" rx="2.5" />
        <rect className="empty-desk-ferrule" x="149" y="132" width="7" height="12" />
        <rect className="empty-desk-pencil" x="156" y="132" width="54" height="12" />
        <line className="empty-desk-pencil-edge" x1="156" x2="210" y1="138" y2="138" />
        <path className="empty-desk-wood" d="M210 132 L224 138 L210 144 Z" />
        <path className="empty-desk-lead" d="M219.5 136 L224 138 L219.5 140 Z" />
      </g>
      {/* 포스트잇 */}
      <g transform="rotate(7 52 128)">
        <rect className="empty-desk-note" x="22" y="100" width="62" height="56" rx="1.5" />
        <path className="empty-desk-note-fold" d="M74 156 L84 146 L84 156 Z" />
        <text className="empty-desk-hand" x="53" y="124" textAnchor="middle">
          곧
        </text>
        <text className="empty-desk-hand" x="53" y="143" textAnchor="middle">
          채울게요
        </text>
      </g>
    </svg>
  );
}
