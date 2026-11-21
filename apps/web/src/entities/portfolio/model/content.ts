// 포트폴리오 내용의 원본. 홈, 포트폴리오 페이지, 숨은 터미널, PDF 생성기(scripts/portfolio-pdf.mjs)가 모두 이 파일을 읽음
// PDF 생성기는 이 파일을 Node 로 바로 불러오므로 다른 모듈을 import 하지 않고, 지워지는 타입 표기만 씀 (enum, namespace 금지)
// 문체 규칙: 가운뎃점, em dash, 수학 마이너스, 검은 사각형은 쓰지 않음 (scripts/portfolio-pdf.test.mjs 가 검사)

/** 한 줄 글. 문자열 사이에 형광펜(mark)이나 손글씨 메모(pen)를 섞을 수 있음 */
export type RichText = string | readonly (string | { mark: string } | { pen: string })[];

export interface Entry {
  title: string;
  period: string;
  /** 지금도 진행 중이면 기간에 형광펜을 칠함 */
  live?: boolean;
  award?: string;
  role?: string;
  desc?: string;
  points: readonly RichText[];
  stack: readonly string[];
  link?: string;
}

export interface Portfolio {
  name: string;
  lead: string;
  email: string;
  github: string;
  siteUrl: string;
  about: readonly { label: string; text: string }[];
  work: readonly Entry[];
  projects: readonly Entry[];
  skills: readonly { label: string; items: readonly string[] }[];
  history: readonly { when: string; what: string; note?: string }[];
}

export const portfolio: Portfolio = {
  name: '김가원',
  lead: 'AI 플랫폼의 화면부터 서버 연동까지 개발하는 Software Engineer입니다.',
  email: 'kgw1999zz@naver.com',
  github: 'https://github.com/wongakim-99',
  siteUrl: 'https://gawon-dev.tail7c7524.ts.net',

  about: [
    {
      label: '회사에서',
      text: '국가 R&D 과제의 공공 분야 통합 데이터 플랫폼에서 Spring Boot API와 Vue 3 화면을 개발합니다. 외부 AI 엔진의 분석 요청부터 결과 저장과 조회까지 연결하고 있습니다.',
    },
    {
      label: '학교에서',
      text: "한국어 학습 플랫폼 '이로운'으로 2025 세종 DX 해커톤 최우수상을 받았습니다. 동아리 리크루팅 플랫폼 '똑똑'에서는 가변 지원서와 인증을 설계하고, AWS 환경에서 부하 테스트를 진행했습니다.",
    },
    {
      label: '집에서',
      text: 'Ubuntu 홈서버에 이 페이지와 운영 패널을 Docker로 배포하고, Tailscale을 통해 서버에 접속해 관리하고 있습니다.',
    },
  ],

  work: [
    {
      title: '㈜씨에스리',
      period: '2026.06 ~ 재직 중',
      role: '솔루션 개발센터 1팀 / Software Engineer (계약직)',
      desc: '국가 R&D 과제 / 공공 분야 통합 데이터 플랫폼',
      points: [
        ['서비스 4종과 개발 서버 10대의 호출 관계를 코드, 설정, 연결 지표로 대조해 연결선 56개의 근거와 포트 불일치 0건 확인 ', { pen: '(2026.11 기록)' }],
        '납품 FastAPI 엔진의 CPU 전처리와 H200 GPU 추론을 분리하고, 공용 vLLM 연동용 모델 API와 원격 어댑터 구현',
        'Vue 3 분석 화면에서 자료 종류 선택, 비동기 분석 상태, 결과 미리보기와 실패 안내 구현',
        '협력사의 온톨로지 설계를 Java 변환과 AgensGraph 적재, 조회 API에 적용하고 두 표본의 RDB와 그래프 결과 대조',
        'SSE의 DB 연결 점유를 해소해 동시 스트림 55개에서 커넥션 대기 0건, 일반 API 48건 정상 응답 확인',
        '개발 서버 10대의 node-exporter와 Docker 서버 9대의 cAdvisor 관제 구성',
      ],
      stack: ['Java', 'Spring Boot', 'MyBatis', 'Vue 3', 'TypeScript', 'FastAPI', 'AgensGraph', 'MinIO', 'vLLM', 'Docker', 'Prometheus', 'Grafana', 'Jenkins'],
    },
  ],

  projects: [
    {
      title: "AI 한국어 학습 플랫폼 '이로운'",
      period: '2025.07 ~ 2025.08',
      award: '2025 세종 DX 해커톤 최우수상',
      role: 'AI 파이프라인(RAG) 설계, 구현 및 백엔드',
      desc: '초등 돌봄교실 학생 대상 맞춤법 학습 서비스. 교육 도메인에서 치명적인 LLM 환각을 차단하는 RAG 파이프라인 설계, 구현.',
      points: [
        '임베딩 모델 4종(한국어 3, 다국어 1)을 L2 Norm 분포로 정량 비교해 ko-simcse 선정',
        "정규표현식 Custom Loader 로 문체부 맞춤법 PDF 를 '제 N항' 단위로 청킹",
        '비정형 PDF 는 ChromaDB 의미검색, 정형 JSON 은 MongoDB 메타데이터 필터로 인덱싱 이원화',
        ['코사인 유사도 ', { mark: '0.7 미만' }, ' 문서는 LLM 컨텍스트에서 제외'],
      ],
      stack: ['Python', 'FastAPI', 'ChromaDB', 'MongoDB', 'HuggingFace', 'Docker', 'GCP', 'GitHub Actions'],
      link: 'https://github.com/wongakim-99/beneficial-be',
    },
    {
      title: "동아리 리크루팅 플랫폼 '똑똑'",
      period: '2025.06 ~ 2025.10',
      role: '상명대학교 팀 프로젝트 / 백엔드 개발',
      points: [
        '동아리마다 다른 지원서 양식을 PostgreSQL JSONB로 수용해 질문 변경 시 DDL 변경 없이 대응',
        '다중 서버의 토큰 정합성을 Redis 중앙화로 해결하고 TTL로 자동 만료 처리',
        'JMeter 가상 사용자 100명, 총 6,000건 시나리오로 사전 부하 테스트. CloudWatch에서 CPU 10~30%, ALB 대역폭 40% 미만 확인',
      ],
      stack: ['Java 17', 'Spring Boot', 'PostgreSQL', 'Redis', 'QueryDSL', 'AWS (EB, ALB, RDS, S3)', 'GitHub Actions', 'JMeter'],
      link: 'https://github.com/wongakim-99/backend',
    },
    {
      title: "반려동물 분양 매칭 플랫폼 '포퐁'",
      period: '2026.03 ~ 진행 중',
      live: true,
      role: '팀 프로젝트 / 백엔드 개발',
      points: [
        '5xx 발생 시 Discord 즉시 알림 (5분 쿨다운으로 중복 방지, 스택트레이스와 요청 경로, 사용자 ID 동봉)',
        'Loki, Promtail, Grafana 와 LogQL 로 Blue/Green 환경별 로그 분리 추적',
        'E2E 테스트 선작성 후 AI 구현, typecheck 와 test:e2e 자동 검증, 커밋 승인은 사람이 담당',
      ],
      stack: ['NestJS 11', 'TypeScript', 'MongoDB', 'Redis', 'BullMQ', 'Kafka', 'AWS S3'],
      link: 'https://github.com/Pawpong/pawpong_backend',
    },
    {
      title: '홈서버 포트폴리오 운영',
      period: '2026.10 ~ 운영 중',
      live: true,
      role: '개인 프로젝트 / 개발, 배포, 운영',
      points: [
        'Docker Compose로 이 페이지와 NestJS API, MongoDB를 Ubuntu 홈서버에서 운영',
        'Tailscale Funnel로 HTTPS 공개, Serve로 운영 패널에 비공개 접속',
        'GitHub Actions runner로 자동 배포하고 MongoDB를 매일 백업',
      ],
      stack: ['Ubuntu', 'Docker', 'Tailscale', 'NestJS', 'MongoDB', 'GitHub Actions'],
    },
  ],

  skills: [
    { label: 'Backend', items: ['Java', 'Spring Boot', 'MyBatis', 'JPA', 'QueryDSL', 'FastAPI', 'NestJS'] },
    { label: 'Frontend', items: ['Vue 3', 'TypeScript', 'Vite', 'Vitest'] },
    { label: 'Data, AI', items: ['PostgreSQL', 'AgensGraph', 'MongoDB', 'Redis', 'MinIO', 'vLLM'] },
    { label: 'Infra, Ops', items: ['Docker', 'Jenkins', 'GitHub Actions', 'AWS', 'Prometheus', 'Grafana', 'Loki', 'JMeter'] },
  ],

  history: [
    { when: '2026.06', what: 'OPIc IH' },
    { when: '2026.04 ~ 06', what: 'LG U+ 유레카 4기 백엔드 개발자 과정 수료', note: '멀티캠퍼스' },
    { when: '2025.08', what: '2025 세종 DX 해커톤 최우수상', note: '(재)세종테크노파크' },
    { when: '2025.03', what: '조코딩 × OpenAI × Primer AI 해커톤 본선 진출', note: '참가팀 1,300+ 중 상위 30위 이내' },
    { when: '2020.03 ~ 2026.02', what: '상명대학교 소프트웨어학과 졸업', note: '공학사' },
  ],
};
