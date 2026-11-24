import { NotFoundException, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import { vi } from 'vitest';
import type { App } from 'supertest/types.js';
import { ProofGrader, ProofUsageRepository, RoomClassifier, type RoomCandidate } from '../src/modules/blog/domain/blog.ports.js';
import {
  PROOF_DAILY_PER_VISITOR, PROOF_DAILY_TOTAL, PROOF_GRADER_CHARS, PROOF_MAX, PROOF_PROBLEMS, proofDay, type ProofSubmission,
} from '../src/modules/blog/domain/proof.js';
import { VideoSource } from '../src/modules/feed/domain/feed.ports.js';
import { readRelease } from '../src/modules/ops/index.js';
import { configureApp } from '../src/setup.js';
import { Mailer } from '../src/shared/infrastructure/mail/mailer.js';
import { ObjectStorage } from '../src/shared/infrastructure/storage/object-storage.js';

const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
let mongo: MongoMemoryServer;
// 보낸 메일을 종류별로 모아 둠. 가입 확인, 재설정은 링크의 토큰을, 블로그 알림은 토큰 대신 글 제목을 남김
const sentMail: { kind: 'verify' | 'reset' | 'blog-request' | 'blog-granted' | 'proof-limit'; to: string; token: string }[] = [];
const fakeMail = {
  ready: true,
  link: (path: string) => `https://test.example${path}`,
  async send(to: string, subject: string, text: string) {
    const token = (pattern: RegExp) => text.match(pattern)?.[1] ?? '';
    if (subject.includes('이메일 확인')) sentMail.push({ kind: 'verify', to, token: token(/#verify=([\w-]+)/) });
    else if (subject.includes('비밀번호 재설정')) sentMail.push({ kind: 'reset', to, token: token(/#reset=([\w-]+)/) });
    else if (subject.includes('허락되었습니다')) sentMail.push({ kind: 'blog-granted', to, token: token(/'(.+)' 글을/) || '*' });
    else if (subject.includes('열람 요청')) sentMail.push({ kind: 'blog-request', to, token: token(/'(.+)' 글을/) });
    else if (subject.includes('증명 채점 한도')) sentMail.push({ kind: 'proof-limit', to, token: token(/AI 를 (\d+)번/) });
  },
};
// MinIO 대신 메모리에 사진을 보관함
const storedFiles = new Map<string, Buffer>();
const fakeStorage = {
  ready: true,
  async put(key: string, body: Buffer) { storedFiles.set(key, body); },
  async get(key: string) {
    const body = storedFiles.get(key);
    if (!body) throw new NotFoundException('사진을 찾을 수 없습니다.');
    return Readable.from([body]);
  },
  async remove(key: string) { storedFiles.delete(key); },
  health() { return null; },
};
// 바깥 AI 대신 정해 둔 채점평을 조각내 흘려보냄. reply 가 null 이면 AI 를 못 쓰는 때
const gradedProofs: ProofSubmission[] = [];
const fakeGrader = {
  reply: null as string[] | null,
  async grade(submission: ProofSubmission) {
    gradedProofs.push(submission);
    const pieces = this.reply;
    return pieces && (async function* () {
      yield* pieces;
    })();
  },
};

// 방 고르기 AI 대신. pick 이 null 이면 AI 를 못 쓰는 상태
const fakeClassifier = {
  pick: null as ((post: RoomCandidate) => string | null) | null,
  async suggest(posts: RoomCandidate[]) {
    const pick = this.pick;
    return pick && new Map(posts.map((post) => [post.id, pick(post)]));
  },
};

// 바깥 유튜브 대신. 정해 둔 영상 하나만 있고, 썸네일을 몇 번 받으러 갔는지 셈
const KNOWN_VIDEO = 'dQw4w9WgXcQ';
const fakeVideos = {
  thumbnails: 0,
  async meta(id: string) {
    return id === KNOWN_VIDEO ? { title: '테스트 영상', author: '테스트 채널' } : null;
  },
  async thumbnail(id: string) {
    this.thumbnails += 1;
    return id === KNOWN_VIDEO ? jpeg(480, 360) : null;
  },
};

// 머리만 갖춘 사진. API 는 파일 앞부분으로 형식과 가로세로 크기만 확인함
function png(width: number, height: number): Buffer {
  const data = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
  data.writeUInt32BE(13, 8);
  data.write('IHDR', 12, 'latin1');
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0', 'latin1'), Buffer.alloc(9)]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

// ConfigModule.forRoot 가 import 시점에 env 를 읽으므로 env 를 먼저 채우고 동적 import 함
async function createApp(): Promise<INestApplication<App>> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Mailer).useValue(fakeMail)
    .overrideProvider(ObjectStorage).useValue(fakeStorage)
    .overrideProvider(ProofGrader).useValue(fakeGrader)
    .overrideProvider(RoomClassifier).useValue(fakeClassifier)
    .overrideProvider(VideoSource).useValue(fakeVideos)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app as INestApplication<App>;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('portfolio_test');
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.HASH_SALT = 'test-salt';
});

afterAll(async () => {
  await mongo?.stop();
});

describe('health', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('DB 가 붙어 있으면 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});

describe('views', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('같은 IP 는 새로고침해도, 브라우저를 바꿔도 한 번만 셈', async () => {
    const server = app.getHttpServer();
    const first = await request(server).post('/api/views').set('User-Agent', 'visitor-a').expect(200);
    const again = await request(server).post('/api/views').set('User-Agent', 'visitor-a').expect(200);
    const otherBrowser = await request(server).post('/api/views').set('User-Agent', 'visitor-a-safari').expect(200);
    expect(again.body.total).toBe(first.body.total);
    expect(otherBrowser.body.total).toBe(first.body.total);
  });

  // Caddy 컨테이너가 붙여 넘긴 X-Forwarded-For 에서 맨 오른쪽의 공인 주소를 방문자로 봄
  it('프록시 뒤에서도 방문자를 주소별로 구분하고, 앞쪽에 끼워 넣은 주소는 무시함', async () => {
    const server = app.getHttpServer();
    const via = (forwarded: string) =>
      request(server).post('/api/views').set('User-Agent', 'visitor-xff').set('X-Forwarded-For', forwarded).expect(200);
    const first = await via('203.0.113.7, 172.18.0.1');
    const spoofed = await via('198.51.100.1, 203.0.113.7, 172.18.0.1');
    expect(spoofed.body.total).toBe(first.body.total);
    const other = await via('203.0.113.8, 172.18.0.1');
    expect(other.body.total).toBe(first.body.total + 1);
  });

  it('처음 온 IP 는 1 증가하고, 표식은 시간이 지나도 남아 다시 세지 않음', async () => {
    const server = app.getHttpServer();
    const before = await request(server).get('/api/views').expect(200);
    const firstVisit = await request(server).post('/api/views').set('X-Forwarded-For', '203.0.113.9, 172.18.0.1').expect(200);
    expect(firstVisit.body.total).toBe(before.body.total + 1);
    const visitors = app.get(getConnectionToken()).collection('view_visitors');
    expect(await visitors.countDocuments()).toBe(firstVisit.body.total);
    const indexes = await visitors.indexes();
    expect(indexes.some((index: { expireAfterSeconds?: number }) => index.expireAfterSeconds !== undefined)).toBe(false);
  });
});

describe('deploys', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  const record = (body: object, token = ADMIN_TOKEN) =>
    request(app.getHttpServer()).post('/api/deploys').set('Authorization', `Bearer ${token}`).send(body);

  it('관리자 토큰이 있어야 배포 기록을 남김', async () => {
    const body = { commit: 'abc1234', subject: 'feat: 첫 배포', durationSec: 40, result: 'success' };
    await request(app.getHttpServer()).post('/api/deploys').send(body).expect(401);
    await record(body, 'wrong-token-0123456789abcdef').expect(401);
    await record({ ...body, commit: 'not-a-sha' }).expect(400);
    await record({ ...body, result: 'maybe' }).expect(400);
    await record(body).expect(201);
  });

  it('최근 배포부터 보여 주고, 같은 기록을 다시 보내도 한 건만 남음', async () => {
    const server = app.getHttpServer();
    const older = { commit: '1111111aaaa', subject: 'fix: 예전 배포', durationSec: 30, result: 'success', deployedAt: '2026-11-01T00:00:00Z' };
    const newer = { commit: '2222222', subject: '  feat:   새   배포  ', durationSec: 52, result: 'rolled-back', deployedAt: '2026-11-20T00:00:00Z' };
    await record(older).expect(201);
    await record(older).expect(201);
    await record(newer).expect(201);
    const res = await request(server).get('/api/deploys?limit=2').expect(200);
    // 앞 테스트에서 지금 시각으로 남긴 abc1234 가 가장 최근
    expect(res.body.deploys).toEqual([
      expect.objectContaining({ commit: 'abc1234', subject: 'feat: 첫 배포' }),
      { commit: '2222222', subject: 'feat: 새 배포', deployedAt: '2026-11-20T00:00:00.000Z', durationSec: 52, result: 'rolled-back' },
    ]);
    const all = await request(server).get('/api/deploys?limit=30').expect(200);
    expect(all.body.deploys.filter((deploy: { commit: string }) => deploy.commit === '1111111')).toHaveLength(1);
  });
});

describe('messages', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('저장 후 관리자 토큰으로만 조회됨', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/messages')
      .send({ name: '  방문자  ', email: '', message: '포트폴리오 잘 봤습니다' })
      .expect(201);

    await request(server).get('/api/messages').expect(401);
    await request(server).get('/api/messages').set('Authorization', 'Bearer wrong-token').expect(401);

    const res = await request(server)
      .get('/api/messages')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(res.body.messages[0]).toMatchObject({ name: '방문자', message: '포트폴리오 잘 봤습니다' });
    expect(res.body.messages[0]).not.toHaveProperty('email');
    expect(res.body.messages[0]).not.toHaveProperty('visitorHash');
  });

  it('honeypot 이 채워지면 성공처럼 응답하고 저장하지 않음', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/messages')
      .send({ name: 'bot', message: 'buy cheap things now', website: 'http://spam.example' })
      .expect(201);
    const res = await request(server)
      .get('/api/messages')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(res.body.messages.map((m: { name: string }) => m.name)).not.toContain('bot');
  });
});

describe('messages 검증과 제한', () => {
  let app: INestApplication<App>;
  beforeEach(async () => (app = await createApp()));
  afterEach(async () => app.close());

  it('짧은 본문, 잘못된 메일, 모르는 필드는 400', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/messages').send({ name: 'a', message: 'hi' }).expect(400);
    await request(server)
      .post('/api/messages')
      .send({ name: 'a', email: 'not-mail', message: 'hello there' })
      .expect(400);
  });

  it('모르는 필드는 400', async () => {
    await request(app.getHttpServer())
      .post('/api/messages')
      .send({ name: 'a', message: 'hello there', admin: true })
      .expect(400);
  });

  it('같은 IP 에서 10분에 3건을 넘기면 429', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) {
      await request(server).post('/api/messages').send({ name: 'a', message: `hello ${i} there` }).expect(201);
    }
    await request(server).post('/api/messages').send({ name: 'a', message: 'one more time' }).expect(429);
  });
});

describe('community', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('가입, 로그인, 글과 댓글 작성에서 권한 및 신고를 확인', async () => {
    const server = app.getHttpServer();
    const register = (email: string, name: string) => request(server)
      .post('/api/community/auth/register')
      .send({ email, name, password: 'correct horse battery staple' });
    await register('writer@example.com', '글쓴이').expect(202);
    await register('reader@example.com', '독자').expect(202);
    await request(server).post('/api/community/auth/login')
      .send({ email: 'writer@example.com', password: 'correct horse battery staple' }).expect(403);
    const verifyA = sentMail.find((mail) => mail.kind === 'verify' && mail.to === 'writer@example.com')!;
    const verifyB = sentMail.find((mail) => mail.kind === 'verify' && mail.to === 'reader@example.com')!;
    const a = await request(server).post('/api/community/auth/verify').send({ token: verifyA.token }).expect(200);
    const b = await request(server).post('/api/community/auth/verify').send({ token: verifyB.token }).expect(200);
    await request(server).post('/api/community/auth/verify').send({ token: verifyA.token }).expect(400);
    const cookieA = (a.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const cookieB = (b.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(a.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(a.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect((await request(server).get('/api/community/auth/me').expect(200)).body.user).toBeNull();
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookieA).expect(200)).body.user.name).toBe('글쓴이');

    await request(server).post('/api/community/posts').send({ title: '첫 번째 글', body: '본문은 스무 글자보다 길어야 합니다. 첫 게시글입니다.' }).expect(401);
    await request(server).post('/api/community/posts').set('Cookie', cookieA)
      .set('Origin', 'https://evil.example')
      .send({ title: '외부 요청', body: '이 요청은 다른 사이트에서 보낸 내용입니다.' }).expect(403);

    const created = await request(server).post('/api/community/posts').set('Cookie', cookieA)
      .send({ title: '첫 번째 글', body: '본문은 스무 글자보다 길어야 합니다. 첫 게시글입니다.' }).expect(201);
    const postId = created.body.post.id;
    expect((await request(server).get('/api/community/posts').expect(200)).body.posts[0].title).toBe('첫 번째 글');
    await request(server).patch(`/api/community/posts/${postId}`).set('Cookie', cookieB)
      .send({ title: '수정한 제목', body: '다른 사람의 게시글은 수정할 수 없어야 합니다.' }).expect(403);

    const comment = await request(server).post(`/api/community/posts/${postId}/comments`).set('Cookie', cookieB)
      .send({ body: '잘 읽었습니다. 좋은 글이네요.' }).expect(201);
    const commentId = comment.body.comment.id;
    expect((await request(server).get(`/api/community/posts/${postId}/comments`).expect(200)).body.comments[0].body).toContain('좋은 글');
    await request(server).patch(`/api/community/comments/${commentId}`).set('Cookie', cookieA)
      .send({ body: '다른 사람 댓글 수정' }).expect(403);

    await request(server).post('/api/community/reports').set('Cookie', cookieA)
      .send({ targetType: 'comment', targetId: commentId, reason: 'spam' }).expect(204);
    await request(server).post('/api/community/reports').set('Cookie', cookieA)
      .send({ targetType: 'comment', targetId: commentId, reason: 'spam' }).expect(409);
    await request(server).get('/api/community/admin/reports').expect(401);
    const reports = await request(server).get('/api/community/admin/reports')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
    expect(reports.body.reports[0]).toMatchObject({ targetType: 'comment', targetId: commentId, reason: 'spam' });

    await request(server).delete(`/api/community/admin/comments/${commentId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(204);
    expect((await request(server).get(`/api/community/posts/${postId}`).expect(200)).body.commentCount).toBe(0);
    const afterModeration = await request(server).get('/api/community/admin/reports')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
    expect(afterModeration.body.reports).toEqual([]);
    await request(server).delete(`/api/community/posts/${postId}`).set('Cookie', cookieB).expect(403);
    await request(server).delete(`/api/community/posts/${postId}`).set('Cookie', cookieA).expect(204);
    await request(server).get(`/api/community/posts/${postId}`).expect(404);
  });

  it('피드 쓰레드: 제목 없는 짧은 글, 사진, 유튜브 미리보기, 답글 타래, 좋아요', async () => {
    const server = app.getHttpServer();
    const ip = '203.0.113.90, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    };
    const writer = await join('thread-writer@example.com', '타래 글쓴이');
    const reader = await join('thread-reader@example.com', '타래 독자');
    const post = (cookie: string, body: object) => request(server).post('/api/community/posts').set('X-Forwarded-For', ip).set('Cookie', cookie).send(body);

    // 짧은 글: 제목 없이 500자까지. 첫 유튜브 링크는 제목과 채널을 읽어 둠
    const short = await post(writer, { body: `같이 봐요 https://youtu.be/${KNOWN_VIDEO}?t=3` }).expect(201);
    expect(short.body.post).toMatchObject({
      title: '', likeCount: 0, liked: false, photos: [],
      video: { id: KNOWN_VIDEO, title: '테스트 영상', author: '테스트 채널', thumbnail: `/api/community/videos/${KNOWN_VIDEO}/thumbnail` },
    });
    await post(writer, { body: '가'.repeat(501) }).expect(400);
    await post(writer, { body: '' }).expect(400);
    await post(writer, { title: '제목 있는 긴 글', body: '너무 짧음' }).expect(400);
    await post(writer, { title: '제목 있는 긴 글', body: '긴 글은 예전처럼 제목과 스무 글자 넘는 본문을 씁니다.' }).expect(201);

    // 따로 붙인 링크: 유튜브면 영상 미리보기, 다른 주소면 사이트 이름과 주소만. 링크만 있는 글도 됨. http(s) 가 아니면 400
    const linked = await post(writer, { body: '', link: `https://www.youtube.com/watch?v=${KNOWN_VIDEO}` }).expect(201);
    expect(linked.body.post).toMatchObject({ link: { url: `https://www.youtube.com/watch?v=${KNOWN_VIDEO}`, host: 'youtube.com' }, video: { id: KNOWN_VIDEO } });
    const other = await post(writer, { body: '읽어 볼 글', link: ' https://www.example.com/a/b?c=1 ' }).expect(201);
    expect(other.body.post).toMatchObject({ link: { url: 'https://www.example.com/a/b?c=1', host: 'example.com' }, video: null });
    await post(writer, { body: '나쁜 링크', link: 'javascript:alert(1)' }).expect(400);
    await post(writer, { body: '나쁜 링크', link: 'ftp://example.com/file' }).expect(400);

    // 썸네일은 확인한 영상만, 한 번 받아 저장소에 두고 다시 씀
    const thumb = await request(server).get(`/api/community/videos/${KNOWN_VIDEO}/thumbnail`).expect(200);
    expect(thumb.headers['content-type']).toBe('image/jpeg');
    expect(thumb.headers['cross-origin-resource-policy']).toBe('same-origin');
    await request(server).get(`/api/community/videos/${KNOWN_VIDEO}/thumbnail`).expect(200);
    expect(fakeVideos.thumbnails).toBe(1);
    await request(server).get('/api/community/videos/aaaaaaaaaaa/thumbnail').expect(404);
    await request(server).get(`/api/community/videos/${KNOWN_VIDEO}`).expect(401);
    expect((await request(server).get(`/api/community/videos/${KNOWN_VIDEO}`).set('Cookie', writer).expect(200)).body.video.title).toBe('테스트 영상');
    await request(server).get('/api/community/videos/bbbbbbbbbbb').set('Cookie', writer).expect(404);

    // 사진: 회원만 올리고, 내 사진만 내 글에 붙음. 사진만 올린 짧은 글도 됨
    const upload = (cookie: string | null, body: Buffer) => {
      const req = request(server).post('/api/community/images').set('X-Forwarded-For', ip).set('Content-Type', 'image/png');
      return (cookie ? req.set('Cookie', cookie) : req).send(body);
    };
    await upload(null, png(800, 600)).expect(401);
    await upload(writer, png(5000, 10)).expect(400);
    const photo = (await upload(writer, png(800, 600)).expect(201)).body.image;
    await post(reader, { body: '', photos: [photo.file] }).expect(400);
    await post(writer, { body: '', photos: ['a'.repeat(24) + '.png', 'b'.repeat(24) + '.png', 'c'.repeat(24) + '.png', 'd'.repeat(24) + '.png', 'e'.repeat(24) + '.png'] }).expect(400);
    const photoPost = await post(writer, { body: '', photos: [photo.file] }).expect(201);
    expect(photoPost.body.post.photos).toEqual([{ file: photo.file, url: `/api/community/images/${photo.file}` }]);
    const image = await request(server).get(`/api/community/images/${photo.file}`).expect(200);
    expect(image.headers['cross-origin-resource-policy']).toBe('same-origin');

    // 답글 타래: 답글에 단 답글은 첫 답글 아래로 모이고, 누구에게 답했는지 남음
    const postId = short.body.post.id;
    const reply = (cookie: string, body: object) => request(server).post(`/api/community/posts/${postId}/comments`).set('X-Forwarded-For', ip).set('Cookie', cookie).send(body);
    const first = (await reply(reader, { body: '좋아요!' }).expect(201)).body.comment;
    const second = (await reply(writer, { body: '고마워요', parentId: first.id }).expect(201)).body.comment;
    const third = (await reply(reader, { body: '또 올려 주세요', parentId: second.id }).expect(201)).body.comment;
    expect(first).toMatchObject({ parentId: null, replyToName: null });
    expect(second).toMatchObject({ parentId: first.id, replyToName: '타래 독자' });
    expect(third).toMatchObject({ parentId: first.id, replyToName: '타래 글쓴이' });
    const otherPost = photoPost.body.post.id;
    await request(server).post(`/api/community/posts/${otherPost}/comments`).set('X-Forwarded-For', ip).set('Cookie', reader)
      .send({ body: '엉뚱한 타래', parentId: first.id }).expect(404);
    expect((await request(server).get(`/api/community/posts/${postId}`).expect(200)).body.commentCount).toBe(3);

    // 좋아요: 한 사람이 한 번만, 보는 사람마다 눌렀는지가 다름
    await request(server).put(`/api/community/posts/${postId}/like`).expect(401);
    expect((await request(server).put(`/api/community/posts/${postId}/like`).set('Cookie', reader).expect(200)).body).toEqual({ likeCount: 1, liked: true });
    expect((await request(server).put(`/api/community/posts/${postId}/like`).set('Cookie', reader).expect(200)).body.likeCount).toBe(1);
    const asReader = await request(server).get('/api/community/posts').set('Cookie', reader).expect(200);
    expect(asReader.headers['cache-control']).toBe('private, no-store');
    expect(asReader.body.posts.find((item: { id: string }) => item.id === postId)).toMatchObject({ likeCount: 1, liked: true });
    expect((await request(server).get(`/api/community/posts/${postId}`).expect(200)).body).toMatchObject({ likeCount: 1, liked: false });
    expect((await request(server).delete(`/api/community/posts/${postId}/like`).set('Cookie', reader).expect(200)).body.likeCount).toBe(0);
    expect((await request(server).put(`/api/community/comments/${first.id}/like`).set('Cookie', writer).expect(200)).body.likeCount).toBe(1);
    const comments = await request(server).get(`/api/community/posts/${postId}/comments`).set('Cookie', writer).expect(200);
    expect(comments.body.comments.map((item: { liked: boolean }) => item.liked)).toEqual([true, false, false]);

    // 타래의 첫 답글을 지우면 그 아래 답글도 같이 지움. 사진 글을 지우면 사진도 저장소에서 지움
    await request(server).delete(`/api/community/comments/${first.id}`).set('Cookie', writer).expect(403);
    await request(server).delete(`/api/community/comments/${first.id}`).set('Cookie', reader).expect(204);
    expect((await request(server).get(`/api/community/posts/${postId}`).expect(200)).body.commentCount).toBe(0);
    expect((await request(server).get(`/api/community/posts/${postId}/comments`).expect(200)).body.comments).toEqual([]);
    expect(storedFiles.has(`feed/${photo.file}`)).toBe(true);
    await request(server).delete(`/api/community/posts/${otherPost}`).set('Cookie', writer).expect(204);
    expect(storedFiles.has(`feed/${photo.file}`)).toBe(false);
  });

  it('비밀번호 변경은 기존 다른 세션을 해제', async () => {
    const server = app.getHttpServer();
    const second = await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(200);
    const oldCookie = (second.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const first = await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(200);
    const currentCookie = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(server).post('/api/community/auth/password').set('Cookie', currentCookie)
      .send({ currentPassword: 'correct horse battery staple', newPassword: 'nine char' }).expect(400);
    await request(server).post('/api/community/auth/password').set('Cookie', currentCookie)
      .send({ currentPassword: 'correct horse battery staple', newPassword: 'another long password 2026' }).expect(204);
    expect((await request(server).get('/api/community/auth/me').set('Cookie', oldCookie).expect(200)).body.user).toBeNull();
    await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'correct horse battery staple' }).expect(401);
    await request(server).post('/api/community/auth/login')
      .send({ email: 'reader@example.com', password: 'another long password 2026' }).expect(200);
  });

  it('비밀번호 재설정 링크는 한 번만 사용하고 모든 세션을 해제', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/api/community/auth/login')
      .set('X-Forwarded-For', '203.0.113.99, 172.18.0.1')
      .send({ email: 'writer@example.com', password: 'correct horse battery staple' }).expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(server).post('/api/community/auth/reset-request')
      .send({ email: 'writer@example.com' }).expect(202);
    const token = sentMail.findLast((mail) => mail.kind === 'reset' && mail.to === 'writer@example.com')!.token;
    await request(server).post('/api/community/auth/reset')
      .send({ token, newPassword: 'new verified password 2026' }).expect(204);
    await request(server).post('/api/community/auth/reset')
      .send({ token, newPassword: 'another reset password' }).expect(400);
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookie).expect(200)).body.user).toBeNull();
    await request(server).post('/api/community/auth/login')
      .set('X-Forwarded-For', '203.0.113.99, 172.18.0.1')
      .send({ email: 'writer@example.com', password: 'new verified password 2026' }).expect(200);
  });

  it('내 페이지: 사진은 형식과 크기를 확인해 바꾸고, 이름을 바꾸면 글에도 반영', async () => {
    const server = app.getHttpServer();
    // 앞선 테스트가 기본 주소의 요청 한도를 써 버려서 다른 주소로 보냄
    const ip = '203.0.113.120, 172.18.0.1';
    // 비밀번호는 10자부터 받음
    await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
      .send({ email: 'short@example.com', name: '짧은비번', password: 'nine char' }).expect(400);
    await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
      .send({ email: 'photo@example.com', name: '사진주인', password: 'ten chars!' }).expect(202);
    const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === 'photo@example.com')!.token;
    const verified = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
    const cookie = (verified.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const id = verified.body.user.id;
    expect(verified.body.user.avatarUrl).toBeNull();
    await request(server).post('/api/community/posts').set('X-Forwarded-For', ip).set('Cookie', cookie)
      .send({ title: '사진 올린 사람의 글', body: '프로필 사진이 글 목록에도 보이는지 확인합니다.' }).expect(201);

    const upload = (body: Buffer, type = 'image/png') => request(server).put('/api/community/me/avatar')
      .set('X-Forwarded-For', ip).set('Cookie', cookie).set('Content-Type', type).send(body);
    await request(server).put('/api/community/me/avatar').set('X-Forwarded-For', ip)
      .set('Content-Type', 'image/png').send(png(64, 64)).expect(401);
    await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).expect(415);
    await upload(png(4000, 10)).expect(400);
    await upload(Buffer.alloc(1024 * 1024 + 1)).expect(413);
    const first = await upload(png(64, 64)).expect(200);
    expect(first.body.avatarUrl).toMatch(new RegExp(`^/api/community/avatars/${id}-[a-f0-9]{16}\\.png$`));
    const image = await request(server).get(first.body.avatarUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toContain('immutable');

    // 새 사진을 올리면 옛 사진은 저장소에서 지움. 파일 이름의 형식은 올린 내용으로 정함
    const second = await upload(jpeg(512, 512), 'image/webp').expect(200);
    expect(second.body.avatarUrl).toMatch(/\.jpg$/);
    await request(server).get(first.body.avatarUrl).expect(404);
    expect([...storedFiles.keys()].filter((key) => key.includes(id))).toHaveLength(1);

    await request(server).patch('/api/community/me/profile').set('X-Forwarded-For', ip)
      .send({ name: '새 이름', bio: '' }).expect(401);
    const updated = await request(server).patch('/api/community/me/profile').set('X-Forwarded-For', ip).set('Cookie', cookie)
      .send({ name: '  새   이름 ', bio: '  집 노트북으로 서버를 돌립니다.  ' }).expect(200);
    expect(updated.body.user).toMatchObject({ id, name: '새 이름', bio: '집 노트북으로 서버를 돌립니다.', avatarUrl: second.body.avatarUrl, postCount: 1 });
    const publicProfile = await request(server).get(`/api/community/users/${id}`).expect(200);
    expect(publicProfile.body).not.toHaveProperty('email');
    const mine = await request(server).get(`/api/community/posts?author=${id}`).expect(200);
    expect(mine.body.posts).toHaveLength(1);
    expect(mine.body.posts[0]).toMatchObject({ authorName: '새 이름', authorAvatarUrl: second.body.avatarUrl });
    expect((await request(server).get('/api/community/auth/me').set('Cookie', cookie).expect(200)).body.user.avatarUrl)
      .toBe(second.body.avatarUrl);

    await request(server).delete('/api/community/me/avatar').set('Cookie', cookie).expect(204);
    await request(server).get(second.body.avatarUrl).expect(404);
    expect((await request(server).get(`/api/community/users/${id}`).expect(200)).body.avatarUrl).toBeNull();
    await request(server).get('/api/community/avatars/..%2F..%2Fsecret.png').expect(404);
    await request(server).get('/api/community/users/000000000000000000000000').expect(404);
  });

  it('관리자 역할: ADMIN_TOKEN 으로만 지정하고, 관리자는 쪽지와 신고를 보고 남의 글을 지울 수만 있음', async () => {
    const server = app.getHttpServer();
    const ip = '203.0.113.140, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return { cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], user: res.body.user };
    };
    const owner = await join('owner@example.com', '운영자');
    const member = await join('member@example.com', '회원');
    expect(owner.user).toMatchObject({ role: 'member', permissions: [] });
    await request(server).post('/api/messages')
      .send({ name: '방문객', email: 'guest@example.com', message: '홈서버 구경 잘 했어요' }).expect(201);

    await request(server).get('/api/community/admin/messages').expect(401);
    await request(server).get('/api/community/admin/messages').set('Cookie', owner.cookie).expect(403);
    await request(server).put('/api/community/admin/users/role').set('Cookie', owner.cookie)
      .send({ email: 'owner@example.com', role: 'admin' }).expect(401);
    const assign = (body: object) => request(server).put('/api/community/admin/users/role')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(body);
    await assign({ email: 'owner@example.com', role: 'root' }).expect(400);
    await assign({ email: 'nobody@example.com', role: 'admin' }).expect(404);
    await assign({ email: 'OWNER@example.com', role: 'admin' }).expect(200);

    // 역할은 요청마다 다시 읽으므로 이미 로그인한 세션에도 바로 반영됨
    expect((await request(server).get('/api/community/auth/me').set('Cookie', owner.cookie).expect(200)).body.user)
      .toMatchObject({ role: 'admin', permissions: expect.arrayContaining(['messages:read', 'content:moderate']) });
    expect((await request(server).get(`/api/community/users/${owner.user.id}`).expect(200)).body.role).toBe('admin');

    const summary = await request(server).get('/api/community/admin/summary').set('Cookie', owner.cookie).expect(200);
    expect(summary.body.unreadMessages).toBeGreaterThanOrEqual(1);
    expect(summary.headers['cache-control']).toContain('no-store');
    const inbox = await request(server).get('/api/community/admin/messages').set('Cookie', owner.cookie).expect(200);
    const message = inbox.body.messages.find((item: { name: string }) => item.name === '방문객');
    expect(message).toMatchObject({ email: 'guest@example.com', message: '홈서버 구경 잘 했어요', readAt: null });
    expect(message).not.toHaveProperty('visitorHash');
    await request(server).post('/api/community/admin/messages/read').set('Cookie', member.cookie).expect(403);
    await request(server).post('/api/community/admin/messages/read').set('Cookie', owner.cookie)
      .set('Origin', 'https://evil.example').expect(403);
    await request(server).post('/api/community/admin/messages/read').set('Cookie', owner.cookie).expect(204);
    expect((await request(server).get('/api/community/admin/summary').set('Cookie', owner.cookie).expect(200)).body.unreadMessages).toBe(0);
    await request(server).delete(`/api/community/admin/messages/${message.id}`).set('Cookie', member.cookie).expect(403);
    await request(server).delete(`/api/community/admin/messages/${message.id}`).set('Cookie', owner.cookie).expect(204);
    await request(server).delete(`/api/community/admin/messages/${message.id}`).set('Cookie', owner.cookie).expect(404);

    const post = await request(server).post('/api/community/posts').set('X-Forwarded-For', ip).set('Cookie', member.cookie)
      .send({ title: '신고될 회원 글', body: '관리자가 지울 수 있는지 확인하려고 쓴 글입니다.' }).expect(201);
    const postId = post.body.post.id;
    const report = () => request(server).post('/api/community/reports').set('X-Forwarded-For', ip).set('Cookie', owner.cookie)
      .send({ targetType: 'post', targetId: postId, reason: 'spam' });
    await report().expect(204);
    const reportsFor = async () => (await request(server).get('/api/community/admin/reports').set('Cookie', owner.cookie).expect(200))
      .body.reports.filter((item: { targetId: string }) => item.targetId === postId);
    const [reported] = await reportsFor();
    expect(reported).toMatchObject({ reason: 'spam', target: { postId, text: '신고될 회원 글', authorName: '회원' } });
    await request(server).delete(`/api/community/admin/reports/${reported.id}`).set('Cookie', owner.cookie).expect(204);
    expect(await reportsFor()).toEqual([]);
    await report().expect(204);

    // 관리자도 남의 글 내용은 고칠 수 없고, 관리 삭제만 할 수 있음
    await request(server).patch(`/api/community/posts/${postId}`).set('Cookie', owner.cookie)
      .send({ title: '관리자가 고친 제목', body: '관리자라도 남의 글 내용은 고칠 수 없어야 합니다.' }).expect(403);
    await request(server).delete(`/api/community/admin/posts/${postId}`).set('Cookie', member.cookie).expect(403);
    await request(server).delete(`/api/community/admin/posts/${postId}`).set('Cookie', owner.cookie).expect(204);
    expect(await reportsFor()).toEqual([]);

    await assign({ email: 'owner@example.com', role: 'member' }).expect(200);
    await request(server).get('/api/community/admin/messages').set('Cookie', owner.cookie).expect(403);
  });

  it('관리실 토폴로지: 요청과 DB 명령을 순서대로 모으고, 자기 자신의 새로고침은 세지 않음', async () => {
    const server = app.getHttpServer();
    const topology = (since?: number) => request(server)
      .get(`/api/community/admin/topology${since === undefined ? '' : `?since=${since}`}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(server).get('/api/community/admin/topology').expect(401);
    const first = await topology().expect(200);
    expect(first.headers['cache-control']).toContain('no-store');
    expect(first.body.nodes).toMatchObject({ api: { up: true }, mongo: { up: true }, minio: null });
    expect(first.body.host).toHaveProperty('memoryUsedPercent');

    await request(server).get('/api/community/posts').expect(200);
    await request(server).get('/api/community/posts/000000000000000000000000').expect(404);
    await request(server).get('/api/wp-login.php').expect(404);
    const next = await topology(first.body.cursor).expect(200);
    const events = next.body.events as { seq: number; kind: string; label: string; status: number }[];
    expect(events.every((event) => event.seq > first.body.cursor)).toBe(true);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'http', label: 'GET /api/community/posts', status: 200 }),
      expect.objectContaining({ kind: 'http', label: 'GET /api/community/posts/:id', status: 404 }),
      expect.objectContaining({ kind: 'http', label: 'GET (없는 경로)', status: 404 }),
      expect.objectContaining({ kind: 'db', label: 'find' }),
    ]));
    expect(events.some((event) => event.label.includes('topology'))).toBe(false);
    expect(next.body.rates.http).toBeGreaterThanOrEqual(2);
  });
});

describe('blog', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('주인만 글을 쓰고, 공개 범위대로 읽히며, 잠긴 글은 요청을 허락받아야 읽음', async () => {
    const server = app.getHttpServer();
    const ip = '203.0.113.150, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    };
    const owner = await join('blog-owner@example.com', '주인장');
    const friend = await join('blog-friend@example.com', '친구');
    const stranger = await join('blog-stranger@example.com', '지나가던 사람');
    await request(server).put('/api/community/admin/users/role').set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ email: 'blog-owner@example.com', role: 'owner' }).expect(200);
    expect((await request(server).get('/api/community/auth/me').set('Cookie', owner).expect(200)).body.user)
      .toMatchObject({ role: 'owner', permissions: expect.arrayContaining(['blog:write', 'blog:grant', 'messages:read']) });

    const write = (cookie: string | null, title: string, visibility: string) => {
      const req = request(server).post('/api/blog/posts').set('X-Forwarded-For', ip);
      return (cookie ? req.set('Cookie', cookie) : req).send({ title, body: `${title} 본문입니다.`, visibility });
    };
    await write(null, '로그인 안 한 글', 'public').expect(401);
    await write(friend, '회원이 쓴 글', 'public').expect(403);
    await write(owner, '잘못된 범위', 'friends').expect(400);
    await request(server).post('/api/blog/posts').set('Cookie', owner).set('Origin', 'https://evil.example')
      .send({ title: '외부 요청', body: '다른 사이트에서 보낸 글', visibility: 'public' }).expect(403);
    const tech = (await write(owner, '기술 글', 'public').expect(201)).body.post;
    const diary = (await write(owner, '넋두리 하나', 'approved').expect(201)).body.post;
    const diary2 = (await write(owner, '넋두리 둘', 'approved').expect(201)).body.post;
    const secret = (await write(owner, '나만 보는 글', 'private').expect(201)).body.post;
    expect(diary).toMatchObject({ visibility: 'approved', locked: false, body: '넋두리 하나 본문입니다.' });

    // 로그인 전: 공개 글은 읽고, 승인 글은 제목만, 나만 보기 글은 없는 글
    const anonList = (await request(server).get('/api/blog/posts').expect(200)).body.posts;
    expect(anonList.map((post: { title: string }) => post.title)).toEqual(['넋두리 둘', '넋두리 하나', '기술 글']);
    expect(anonList.find((post: { id: string }) => post.id === diary.id)).toMatchObject({ locked: true, excerpt: null });
    expect(anonList.find((post: { id: string }) => post.id === tech.id)).toMatchObject({ locked: false, excerpt: '기술 글 본문입니다.' });
    const locked = await request(server).get(`/api/blog/posts/${diary.id}`).expect(200);
    expect(locked.body).toMatchObject({ title: '넋두리 하나', locked: true, body: null, request: null });
    expect(locked.headers['cache-control']).toContain('no-store');
    await request(server).get(`/api/blog/posts/${secret.id}`).expect(404);
    await request(server).get(`/api/blog/posts/${secret.id}`).set('Cookie', friend).expect(404);
    expect((await request(server).get(`/api/blog/posts/${secret.id}`).set('Cookie', owner).expect(200)).body.body).toBe('나만 보는 글 본문입니다.');
    expect((await request(server).get('/api/blog/posts').set('Cookie', owner).expect(200)).body.posts).toHaveLength(4);

    // 요청은 로그인한 회원만, 잠긴 글에만
    const ask = (cookie: string | null, postId: string, message?: string) => {
      const req = request(server).post(`/api/blog/posts/${postId}/access-requests`).set('X-Forwarded-For', ip);
      return (cookie ? req.set('Cookie', cookie) : req).send(message === undefined ? {} : { message });
    };
    await ask(null, diary.id).expect(401);
    await ask(friend, tech.id).expect(409);
    await ask(friend, secret.id).expect(404);
    expect((await ask(friend, diary.id, '오래된 친구입니다').expect(201)).body.request).toMatchObject({ status: 'pending', retryAt: null });
    await ask(friend, diary.id).expect(409);
    expect((await request(server).get(`/api/blog/posts/${diary.id}`).set('Cookie', friend).expect(200)).body)
      .toMatchObject({ locked: true, body: null, request: { status: 'pending' } });
    await vi.waitFor(() => expect(sentMail).toContainEqual({ kind: 'blog-request', to: 'blog-owner@example.com', token: '넋두리 하나' }));

    await request(server).get('/api/blog/admin/requests').expect(401);
    await request(server).get('/api/blog/admin/requests').set('Cookie', friend).expect(403);
    const pending = (await request(server).get('/api/blog/admin/requests').set('Cookie', owner).expect(200)).body.requests;
    expect(pending).toEqual([expect.objectContaining({ message: '오래된 친구입니다', user: expect.objectContaining({ name: '친구' }), post: { id: diary.id, title: '넋두리 하나' } })]);

    // 이 글만 허락하면 다른 승인 글은 여전히 잠김
    await request(server).post(`/api/blog/admin/requests/${pending[0].id}/approve`).set('Cookie', friend).send({ scope: 'post' }).expect(403);
    await request(server).post(`/api/blog/admin/requests/${pending[0].id}/approve`).set('Cookie', owner).send({ scope: 'everything' }).expect(400);
    await request(server).post(`/api/blog/admin/requests/${pending[0].id}/approve`).set('Cookie', owner).send({ scope: 'post' }).expect(204);
    await request(server).post(`/api/blog/admin/requests/${pending[0].id}/approve`).set('Cookie', owner).send({ scope: 'post' }).expect(404);
    expect((await request(server).get(`/api/blog/posts/${diary.id}`).set('Cookie', friend).expect(200)).body)
      .toMatchObject({ locked: false, body: '넋두리 하나 본문입니다.' });
    expect((await request(server).get(`/api/blog/posts/${diary2.id}`).set('Cookie', friend).expect(200)).body.locked).toBe(true);
    await vi.waitFor(() => expect(sentMail).toContainEqual({ kind: 'blog-granted', to: 'blog-friend@example.com', token: '넋두리 하나' }));

    // 거절하면 3일 동안 다시 보낼 수 없음
    await ask(stranger, diary2.id).expect(201);
    const strangerRequest = (await request(server).get('/api/blog/admin/requests').set('Cookie', owner).expect(200)).body.requests[0];
    await request(server).post(`/api/blog/admin/requests/${strangerRequest.id}/reject`).set('Cookie', owner).expect(204);
    const rejected = (await request(server).get(`/api/blog/posts/${diary2.id}`).set('Cookie', stranger).expect(200)).body;
    expect(rejected).toMatchObject({ locked: true, request: { status: 'rejected' } });
    expect(new Date(rejected.request.retryAt).getTime()).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60_000);
    await ask(stranger, diary2.id).expect(409);
    expect((await request(server).get('/api/blog/admin/requests').set('Cookie', owner).expect(200)).body.requests).toEqual([]);

    // 전부 허락하면 앞으로 쓸 승인 글까지 읽고, 허락을 거두면 다시 잠김
    await ask(friend, diary2.id).expect(201);
    const friendRequest = (await request(server).get('/api/blog/admin/requests').set('Cookie', owner).expect(200)).body.requests[0];
    await request(server).post(`/api/blog/admin/requests/${friendRequest.id}/approve`).set('Cookie', owner).send({ scope: 'all' }).expect(204);
    const later = (await write(owner, '넋두리 셋', 'approved').expect(201)).body.post;
    expect((await request(server).get(`/api/blog/posts/${later.id}`).set('Cookie', friend).expect(200)).body.locked).toBe(false);
    expect((await request(server).get(`/api/blog/posts/${later.id}`).set('Cookie', stranger).expect(200)).body.locked).toBe(true);
    const grants = (await request(server).get('/api/blog/admin/grants').set('Cookie', owner).expect(200)).body.grants;
    expect(grants).toEqual(expect.arrayContaining([
      expect.objectContaining({ user: expect.objectContaining({ name: '친구' }), post: null }),
      expect.objectContaining({ user: expect.objectContaining({ name: '친구' }), post: { id: diary.id, title: '넋두리 하나' } }),
    ]));
    const allGrant = grants.find((grant: { post: unknown }) => grant.post === null);
    await request(server).delete(`/api/blog/admin/grants/${allGrant.id}`).set('Cookie', friend).expect(403);
    await request(server).delete(`/api/blog/admin/grants/${allGrant.id}`).set('Cookie', owner).expect(204);
    expect((await request(server).get(`/api/blog/posts/${later.id}`).set('Cookie', friend).expect(200)).body.locked).toBe(true);
    expect((await request(server).get(`/api/blog/posts/${diary.id}`).set('Cookie', friend).expect(200)).body.locked).toBe(false);

    // 태그는 # 과 겹치는 것을 정리해 저장하고, 태그와 검색과 공개 범위로 목록을 거름
    const tagged = (await request(server).post('/api/blog/posts').set('Cookie', owner)
      .send({ title: '홈서버 가드 정리', body: '공개 본문에만 있는 낱말: 오리너구리', visibility: 'public', tags: ['#NestJS', 'nestjs', ' 홈 서버 ', ''] })
      .expect(201)).body.post;
    expect(tagged).toMatchObject({ tags: ['NestJS', '홈 서버'], readMinutes: 1 });
    await request(server).post('/api/blog/posts').set('Cookie', owner)
      .send({ title: '태그가 너무 많음', body: '본문', visibility: 'public', tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }).expect(400);
    const secretWord = (await write(owner, '잠긴 검색 시험', 'approved').expect(201)).body.post;
    await request(server).patch(`/api/blog/posts/${secretWord.id}`).set('Cookie', owner)
      .send({ title: '잠긴 검색 시험', body: '잠긴 본문에만 있는 낱말: 오리너구리', visibility: 'approved', tags: ['NestJS'] }).expect(200);
    const titles = async (query: string, cookie?: string) => {
      const req = request(server).get(`/api/blog/posts?${query}`);
      return (await (cookie ? req.set('Cookie', cookie) : req).expect(200)).body.posts.map((post: { title: string }) => post.title);
    };
    expect(await titles('tag=NestJS')).toEqual(['잠긴 검색 시험', '홈서버 가드 정리']);
    expect(await titles(`q=${encodeURIComponent('오리너구리')}`)).toEqual(['홈서버 가드 정리']);
    expect(await titles(`q=${encodeURIComponent('오리너구리')}`, owner)).toEqual(['잠긴 검색 시험', '홈서버 가드 정리']);
    expect(await titles(`q=${encodeURIComponent('(.*')}`)).toEqual([]);
    expect(await titles('visibility=private')).toEqual([]);
    expect(await titles('visibility=private', owner)).toEqual(['나만 보는 글']);
    expect(await titles('tag=a&tag=b')).toContain('기술 글');
    const lockedHit = (await request(server).get('/api/blog/posts?tag=NestJS').expect(200)).body.posts[0];
    expect(lockedHit).toMatchObject({ locked: true, excerpt: null, readMinutes: null, tags: ['NestJS'] });

    const guestSummary = (await request(server).get('/api/blog/summary').expect(200)).body;
    expect(guestSummary).toMatchObject({ public: 2, private: null, owner: { name: '주인장' } });
    expect(guestSummary.tags[0]).toEqual({ name: 'NestJS', count: 2 });
    expect((await request(server).get('/api/blog/summary').set('Cookie', owner).expect(200)).body.private).toBe(1);

    // 공개로 바꾸면 누구나 읽고, 지우면 그 글의 허락도 같이 지움
    await request(server).patch(`/api/blog/posts/${diary2.id}`).set('Cookie', owner)
      .send({ title: '넋두리 둘', body: '이제는 공개해도 되는 이야기', visibility: 'public' }).expect(200);
    expect((await request(server).get(`/api/blog/posts/${diary2.id}`).expect(200)).body).toMatchObject({ locked: false, body: '이제는 공개해도 되는 이야기' });
    await request(server).delete(`/api/blog/posts/${diary.id}`).set('Cookie', friend).expect(403);
    await request(server).delete(`/api/blog/posts/${diary.id}`).set('Cookie', owner).expect(204);
    await request(server).get(`/api/blog/posts/${diary.id}`).set('Cookie', owner).expect(404);
    expect((await request(server).get('/api/blog/admin/grants').set('Cookie', owner).expect(200)).body.grants).toEqual([]);
  });

  it('주인장은 사진을 올려 본문과 표지에 쓰고, 글에서 빠지거나 글을 지우면 사진도 지움', async () => {
    const server = app.getHttpServer();
    const ip = '203.0.113.180, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    };
    const owner = await join('photo-owner@example.com', '사진 주인');
    const member = await join('photo-member@example.com', '구경꾼');
    await request(server).put('/api/community/admin/users/role').set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ email: 'photo-owner@example.com', role: 'owner' }).expect(200);
    const upload = (cookie: string | null, body: Buffer, type = 'image/png') => {
      const req = request(server).post('/api/blog/images').set('X-Forwarded-For', ip).set('Content-Type', type);
      return (cookie ? req.set('Cookie', cookie) : req).send(body);
    };

    await upload(null, png(800, 600)).expect(401);
    await upload(member, png(800, 600)).expect(403);
    await upload(owner, Buffer.from('사진이 아닌 글자'), 'image/png').expect(415);
    await upload(owner, png(5000, 10)).expect(400);
    await upload(owner, Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png').expect(413);
    const first = (await upload(owner, png(800, 600)).expect(201)).body.image;
    const second = (await upload(owner, jpeg(640, 480), 'image/jpeg').expect(201)).body.image;
    const hidden = (await upload(owner, png(320, 240)).expect(201)).body.image;
    expect(first).toMatchObject({ url: `/api/blog/images/${first.file}`, width: 800, height: 600 });
    const served = await request(server).get(first.url).expect(200);
    expect(served.headers).toMatchObject({ 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' });
    await request(server).get('/api/blog/images/0123456789abcdef01234567.png').expect(404);
    await request(server).get('/api/blog/images/evil.svg').expect(404);

    // 표지를 고르면 그것이, 안 고르면 본문 첫 사진이 썸네일. 미리보기 글에는 마크다운 기호가 없음
    const body = `# 사진 일기\n\n**굵게** 쓴 본문과 [링크](https://example.com)\n\n![첫 사진](${first.url})\n\n![둘째 사진](${second.url} "캡션")`;
    const write = (input: object, id?: string) => (id
      ? request(server).patch(`/api/blog/posts/${id}`)
      : request(server).post('/api/blog/posts')).set('Cookie', owner).send({ title: '사진 글', visibility: 'public', ...input });
    const post = (await write({ body, cover: second.file }).expect(201)).body.post;
    expect(post).toMatchObject({ cover: second.url, coverFile: second.file });
    const listed = (await request(server).get('/api/blog/posts').expect(200)).body.posts.find((item: { id: string }) => item.id === post.id);
    expect(listed).toMatchObject({ cover: second.url, excerpt: '사진 일기 굵게 쓴 본문과 링크' });
    await write({ body, cover: '../../etc/passwd' }, post.id).expect(400);

    // 잠긴 글은 본문 첫 사진을 썸네일로 쓰지 않음 (본문을 못 읽는 사람에게 사진 주소가 나가지 않게)
    const locked = (await write({ body: `![숨긴 사진](${hidden.url})`, visibility: 'approved' }).expect(201)).body.post;
    const lockedFor = async (cookie?: string) => {
      const req = request(server).get('/api/blog/posts');
      return (await (cookie ? req.set('Cookie', cookie) : req).expect(200)).body.posts.find((item: { id: string }) => item.id === locked.id);
    };
    expect((await lockedFor()).cover).toBeNull();
    expect((await lockedFor(owner)).cover).toBe(hidden.url);

    // 본문과 표지에서 둘째 사진을 빼면 저장소에서도 지우고, 썸네일은 본문 첫 사진으로 돌아감
    const edited = (await write({ body: `본문\n\n![첫 사진](${first.url})`, cover: null }, post.id).expect(200)).body.post;
    expect(edited).toMatchObject({ cover: first.url, coverFile: null });
    await request(server).get(second.url).expect(404);
    await request(server).get(first.url).expect(200);

    await request(server).delete(`/api/blog/posts/${post.id}`).set('Cookie', owner).expect(204);
    await request(server).get(first.url).expect(404);
    await request(server).get(hidden.url).expect(200);
  });

  it('임시 글은 주인장이 덮어쓰고, 글을 올리거나 고치거나 지우면 없어지며, 임시 글에 든 사진은 오래돼도 남김', async () => {
    const server = app.getHttpServer();
    const db = app.get(getConnectionToken());
    const ip = '203.0.113.190, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    };
    const owner = await join('draft-owner@example.com', '임시 주인');
    const member = await join('draft-member@example.com', '엿보는 사람');
    await request(server).put('/api/community/admin/users/role').set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ email: 'draft-owner@example.com', role: 'owner' }).expect(200);
    const read = (key: string, cookie = owner) => request(server).get(`/api/blog/drafts/${key}`).set('Cookie', cookie);
    const save = (key: string, body: object, cookie = owner) => request(server).put(`/api/blog/drafts/${key}`).set('X-Forwarded-For', ip)
      .set('Cookie', cookie).send({ title: '', body: '', visibility: 'approved', ...body });

    await request(server).get('/api/blog/drafts/new').expect(401);
    await read('new', member).expect(403);
    await save('new', {}, member).expect(403);
    const empty = await read('new').expect(200);
    expect(empty.body).toEqual({ draft: null });
    expect(empty.headers['cache-control']).toContain('no-store');

    // 쓰는 중이라 빈 제목, 빈 본문도 받고, 다시 저장하면 덮어씀
    expect((await save('new', {}).expect(200)).body.savedAt).toEqual(expect.any(String));
    const room = (await request(server).post('/api/blog/admin/rooms').set('Cookie', owner).send({ name: '임시 방' }).expect(201)).body.room;
    const photo = (await request(server).post('/api/blog/images').set('X-Forwarded-For', ip).set('Cookie', owner)
      .set('Content-Type', 'image/png').send(png(400, 300)).expect(201)).body.image;
    const loose = (await request(server).post('/api/blog/images').set('X-Forwarded-For', ip).set('Cookie', owner)
      .set('Content-Type', 'image/png').send(png(200, 100)).expect(201)).body.image;
    const content = { title: '쓰다 만 글', body: `첫 줄\n\n![사진](${photo.url})`, visibility: 'public', tags: ['#임시', '임시'], cover: photo.file, roomId: room.id };
    const saved = (await save('new', content).expect(200)).body;
    expect((await read('new').expect(200)).body.draft).toEqual({ ...content, tags: ['임시'], savedAt: saved.savedAt });
    await save('new', { body: 'x'.repeat(50_001) }).expect(400);
    await save('new', { visibility: 'friends' }).expect(400);
    await save('new', { cover: '../../etc/passwd' }).expect(400);
    await save('new', {}).set('Origin', 'https://evil.example').expect(403);
    expect((await read('new').expect(200)).body.draft.title).toBe('쓰다 만 글');

    // 그 사이 지운 방은 비워서 돌려줌
    await request(server).delete(`/api/blog/admin/rooms/${room.id}`).set('Cookie', owner).expect(204);
    expect((await read('new').expect(200)).body.draft.roomId).toBeNull();

    // 글에 안 붙은 채 7일이 지난 사진은 다음 업로드 때 치우지만, 임시 글에 든 사진은 남김
    const aged = new Date(Date.now() - 8 * 24 * 60 * 60_000);
    await db.collection('blog_images').updateMany({ file: { $in: [photo.file, loose.file] } }, { $set: { createdAt: aged } });
    await request(server).post('/api/blog/images').set('X-Forwarded-For', ip).set('Cookie', owner)
      .set('Content-Type', 'image/png').send(png(10, 10)).expect(201);
    await vi.waitFor(() => expect(storedFiles.has(`blog/${loose.file}`)).toBe(false));
    await request(server).get(photo.url).expect(200);

    // 새 글을 올리면 새 글 임시 글이 없어짐
    const post = (await request(server).post('/api/blog/posts').set('Cookie', owner)
      .send({ title: '쓰다 만 글', body: content.body, visibility: 'public' }).expect(201)).body.post;
    expect((await read('new').expect(200)).body.draft).toBeNull();

    // 고치는 글의 임시 글은 그 글 ID 로. 없는 글이면 404, 고쳐 저장하면 없어짐
    await save('not-an-id', {}).expect(404);
    await save(String(new Types.ObjectId()), {}).expect(404);
    await read(String(new Types.ObjectId())).expect(404);
    await save(post.id, { title: '고치는 중', body: '아직 안 올린 문장' }).expect(200);
    expect((await read(post.id).expect(200)).body.draft).toMatchObject({ title: '고치는 중', body: '아직 안 올린 문장' });
    expect((await read('new').expect(200)).body.draft).toBeNull();
    await request(server).patch(`/api/blog/posts/${post.id}`).set('Cookie', owner)
      .send({ title: '고친 글', body: '올린 문장', visibility: 'public' }).expect(200);
    expect((await read(post.id).expect(200)).body.draft).toBeNull();

    // 버리기와 글 지우기
    await save('new', { title: '버릴 글' }).expect(200);
    await request(server).delete('/api/blog/drafts/new').set('Cookie', owner).expect(204);
    expect((await read('new').expect(200)).body.draft).toBeNull();
    await save(post.id, { title: '지울 글을 고치는 중' }).expect(200);
    await request(server).delete(`/api/blog/posts/${post.id}`).set('Cookie', owner).expect(204);
    expect(await db.collection('blog_drafts').countDocuments({ postId: new Types.ObjectId(post.id) })).toBe(0);
  });

  it('잠긴 글의 증명은 채점평만 글자 그대로 흘려보내고, AI 를 못 쓰면 503', async () => {
    const server = app.getHttpServer();
    const posts = app.get(getConnectionToken()).collection('blog_posts');
    const add = async (visibility: string) => String((await posts.insertOne({
      authorId: new Types.ObjectId(), title: `증명 시험 ${visibility}`, body: '본문', visibility, tags: [], createdAt: new Date(), updatedAt: new Date(),
    })).insertedId);
    const [locked, open, secret] = [await add('approved'), await add('public'), await add('private')];
    let ip = 10;
    const prove = (postId: string, body: object) => request(server).post(`/api/blog/posts/${postId}/proofs`)
      .set('X-Forwarded-For', `203.0.113.${ip++}, 172.18.0.1`).send(body);
    const proof = { problem: 'p-vs-np', proof: 'N=1 이면 P=NP 이므로 끝', attempt: 2 };

    fakeGrader.reply = ['N=1 로 ', '우주를 접으셨군요 — 그래도', ' 증명은 아닙니다.'];
    const graded = await prove(locked, proof).expect(200);
    expect(graded.headers['content-type']).toMatch(/^text\/plain/);
    expect(graded.headers['cache-control']).toContain('no-transform');
    expect(graded.text).toBe('N=1 로 우주를 접으셨군요 - 그래도 증명은 아닙니다.');
    expect(gradedProofs.at(-1)).toEqual({ problem: PROOF_PROBLEMS['p-vs-np'], proof: proof.proof, attempt: 2 });

    // 잠긴 글이 아니면 문제도 없음. 나만 보기 글은 있는지도 알리지 않음
    const before = gradedProofs.length;
    await prove(open, proof).expect(404);
    await prove(secret, proof).expect(404);
    await prove('not-an-id', proof).expect(404);
    await prove(locked, { ...proof, problem: 'make-it-pass' }).expect(400);
    await prove(locked, { ...proof, proof: '   ' }).expect(400);
    await prove(locked, { ...proof, proof: 'x'.repeat(4001) }).expect(400);
    await prove(locked, proof).set('Origin', 'https://evil.example').expect(403);
    expect(gradedProofs).toHaveLength(before);

    fakeGrader.reply = null;
    await prove(locked, proof).expect(503);
    fakeGrader.reply = [];
    await prove(locked, proof).expect(503);
  });

  it('블로그 방: 주인장이 만들고 이름과 순서를 정하며, 글을 방으로 거르고, AI 가 고른 방은 확인한 뒤에만 넣음', async () => {
    const server = app.getHttpServer();
    const ip = '198.51.100.240';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    };
    const owner = await join('room-owner@example.com', '방 주인');
    const member = await join('room-member@example.com', '방 구경꾼');
    await request(server).put('/api/community/admin/users/role').set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ email: 'room-owner@example.com', role: 'owner' }).expect(200);
    const admin = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, cookie = owner) =>
      request(server)[method](`/api/blog/admin${path}`).set('X-Forwarded-For', ip).set('Cookie', cookie);

    // 방 만들기, 이름 바꾸기, 순서 (blog:write)
    await request(server).get('/api/blog/admin/rooms').expect(401);
    await admin('get', '/rooms', member).expect(403);
    await admin('post', '/rooms', member).send({ name: '몰래 방' }).expect(403);
    const study = (await admin('post', '/rooms').send({ name: '공부방' }).expect(201)).body.room;
    const chat = (await admin('post', '/rooms').send({ name: '잡담방' }).expect(201)).body.room;
    await admin('post', '/rooms').send({ name: '공부방' }).expect(409);
    await admin('post', '/rooms').send({ name: '' }).expect(400);
    await admin('patch', `/rooms/${chat.id}`).send({ name: '수다방' }).expect(204);
    await admin('patch', `/rooms/${chat.id}`).send({ name: '공부방' }).expect(409);
    await admin('patch', `/rooms/${new Types.ObjectId()}`).send({ name: '없는 방' }).expect(404);
    await admin('put', '/rooms/order').send({ ids: [chat.id] }).expect(400);
    await admin('put', '/rooms/order').send({ ids: [chat.id, study.id] }).expect(204);
    expect((await admin('get', '/rooms').expect(200)).body.rooms.map((room: { name: string }) => room.name)).toEqual(['수다방', '공부방']);

    // 글은 방 하나에 듦. 없는 방은 받지 않음
    const write = (body: object) => request(server).post('/api/blog/posts').set('X-Forwarded-For', ip).set('Cookie', owner).send(body);
    await write({ title: '없는 방 글', body: '본문', visibility: 'public', roomId: String(new Types.ObjectId()) }).expect(400);
    const kafka = (await write({ title: '방 시험 Kafka', body: '메시지 큐', visibility: 'public', roomId: study.id }).expect(201)).body.post;
    expect(kafka.room).toEqual({ id: study.id, name: '공부방' });
    await write({ title: '방 시험 나만 보기', body: '비밀', visibility: 'private', roomId: study.id }).expect(201);
    const lunch = (await write({ title: '방 시험 점심', body: '김치찌개', visibility: 'public' }).expect(201)).body.post;
    expect(lunch.room).toBeNull();

    // 목록 거르기와 사이드바 글 수. 나만 보기 글은 주인장에게만 셈
    const titles = async (query: string, cookie?: string) => {
      const req = request(server).get(`/api/blog/posts?${query}`);
      return (await (cookie ? req.set('Cookie', cookie) : req).expect(200)).body.posts.map((post: { title: string }) => post.title);
    };
    expect(await titles(`room=${study.id}`)).toEqual(['방 시험 Kafka']);
    expect(await titles(`room=${study.id}`, owner)).toEqual(['방 시험 나만 보기', '방 시험 Kafka']);
    expect(await titles('room=none')).toContain('방 시험 점심');
    expect(await titles('room=none')).not.toContain('방 시험 Kafka');
    expect((await request(server).get('/api/blog/summary').expect(200)).body.rooms)
      .toEqual([{ id: chat.id, name: '수다방', count: 0 }, { id: study.id, name: '공부방', count: 1 }]);
    expect((await request(server).get('/api/blog/summary').set('Cookie', owner).expect(200)).body.rooms[1].count).toBe(2);

    // 고칠 때 roomId 를 보내지 않으면(예전 화면) 방은 그대로
    await request(server).patch(`/api/blog/posts/${kafka.id}`).set('X-Forwarded-For', ip).set('Cookie', owner)
      .send({ title: '방 시험 Kafka 2', body: '메시지 큐', visibility: 'public' }).expect(200);
    expect((await request(server).get(`/api/blog/posts/${kafka.id}`).expect(200)).body.room).toEqual({ id: study.id, name: '공부방' });

    // AI 추천은 저장하지 않고 돌려주기만 함. AI 를 못 쓰면 503
    fakeClassifier.pick = null;
    await admin('post', '/rooms/suggest').expect(503);
    fakeClassifier.pick = (post) => (post.title.includes('점심') ? chat.id : null);
    const { suggestions } = (await admin('post', '/rooms/suggest').expect(201)).body;
    expect(suggestions.find((item: { post: { id: string } }) => item.post.id === lunch.id).roomId).toBe(chat.id);
    expect((await request(server).get(`/api/blog/posts/${lunch.id}`).expect(200)).body.room).toBeNull();
    fakeClassifier.pick = () => study.id;
    expect((await admin('post', '/rooms/suggest-draft').send({ title: '새 글', body: '쓰는 중' }).expect(201)).body).toEqual({ roomId: study.id });

    // 주인장이 확인한 것만 넣음
    await admin('post', '/rooms/assign', member).send({ assignments: [{ postId: lunch.id, roomId: chat.id }] }).expect(403);
    await admin('post', '/rooms/assign').send({ assignments: [{ postId: lunch.id, roomId: String(new Types.ObjectId()) }] }).expect(400);
    expect((await admin('post', '/rooms/assign').send({ assignments: [{ postId: lunch.id, roomId: chat.id }] }).expect(201)).body).toEqual({ assigned: 1 });
    expect((await request(server).get(`/api/blog/posts/${lunch.id}`).expect(200)).body.room).toEqual({ id: chat.id, name: '수다방' });

    // 방을 지우면 글은 남고 방 밖으로 나옴
    await admin('delete', `/rooms/${study.id}`).expect(204);
    await admin('delete', `/rooms/${study.id}`).expect(404);
    expect((await request(server).get(`/api/blog/posts/${kafka.id}`).expect(200)).body.room).toBeNull();
    expect((await admin('get', '/rooms').expect(200)).body.rooms.map((room: { id: string }) => room.id)).toEqual([chat.id]);
    fakeClassifier.pick = null;
  });

  it('증명 채점 AI 는 답안 앞 600자만 받고, 하루 한도는 DB 에 남겨 IP 당 10번, 전체 200번에서 멈추며 다 쓰면 주인장에게 알림', async () => {
    const server = app.getHttpServer();
    const db = app.get(getConnectionToken());
    const locked = String((await db.collection('blog_posts').insertOne({
      authorId: new Types.ObjectId(), title: '한도 시험', body: '본문', visibility: 'approved', tags: [], createdAt: new Date(), updatedAt: new Date(),
    })).insertedId);
    let ip = 100;
    const prove = (proof: string) => request(server).post(`/api/blog/posts/${locked}/proofs`)
      .set('X-Forwarded-For', `198.51.100.${ip++}, 172.18.0.1`).send({ problem: 'riemann', proof });

    // 한도에 닿을 때 알림을 받을 주인장
    const ownerIp = '198.51.100.250';
    await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ownerIp)
      .send({ email: 'proof-owner@example.com', name: '채점 주인', password: 'correct horse battery staple' }).expect(202);
    const verify = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === 'proof-owner@example.com')!.token;
    const verified = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ownerIp).send({ token: verify }).expect(200);
    const owner = (verified.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(server).put('/api/community/admin/users/role').set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ email: 'proof-owner@example.com', role: 'owner' }).expect(200);

    // 꽉 채운 답안도 AI 에게는 앞 600자만
    fakeGrader.reply = ['아닙니다.'];
    await prove('가'.repeat(PROOF_MAX)).expect(200);
    expect(gradedProofs.at(-1)!.proof).toBe(`${'가'.repeat(PROOF_GRADER_CHARS)}\n(뒷부분 생략)`);

    // IP 당 하루 10번. 같은 IP 는 1분 6번 제한에 먼저 걸리므로 횟수 저장소를 바로 부름. 이틀 뒤 지워지게 expireAt 이 붙음
    const usage = app.get(ProofUsageRepository);
    const day = proofDay();
    const wide = { total: 1_000_000, perVisitor: PROOF_DAILY_PER_VISITOR };
    for (let used = 0; used < PROOF_DAILY_PER_VISITOR; used += 1) expect(await usage.take(day, 'same-visitor', wide)).not.toBeNull();
    expect(await usage.take(day, 'same-visitor', wide)).toBeNull();
    expect((await db.collection('blog_proof_usage').findOne({ _id: `${day}:same-visitor` }))?.expireAt).toBeInstanceOf(Date);

    // 사이트 전체 200번째에서 주인장에게 알리고, 그 뒤로는 AI 를 부르지 않음. 횟수는 DB 값을 이어서 셈 (배포해도 그대로)
    await db.collection('blog_proof_usage').updateOne({ _id: day }, { $set: { count: PROOF_DAILY_TOTAL - 1 } });
    const limitMails = () => sentMail.filter((mail) => mail.kind === 'proof-limit' && mail.to === 'proof-owner@example.com');
    await prove('마지막 한 번').expect(200);
    await vi.waitFor(() => expect(limitMails()).toEqual([{ kind: 'proof-limit', to: 'proof-owner@example.com', token: String(PROOF_DAILY_TOTAL) }]));
    const graded = gradedProofs.length;
    await prove('한도 넘은 답안').expect(503);
    expect(gradedProofs).toHaveLength(graded);
    expect(limitMails()).toHaveLength(1);

    // 관리실에서 오늘 사용량을 봄 (blog:grant)
    await request(server).get('/api/blog/admin/proof-usage').expect(401);
    expect((await request(server).get('/api/blog/admin/proof-usage').set('Cookie', owner).expect(200)).body)
      .toEqual({ day, total: PROOF_DAILY_TOTAL, limit: PROOF_DAILY_TOTAL, perVisitor: PROOF_DAILY_PER_VISITOR });
  });
});

// 가짜 /sys 를 만들어 홈서버 노트북의 센서 파일 구조를 흉내 냄
async function fakeSysfs(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sysfs-'));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), `${content}\n`);
  }
  return root;
}

describe('server', () => {
  let app: INestApplication<App>;
  let sysfs: string;

  afterEach(async () => {
    await app?.close();
    delete process.env.SYSFS_ROOT;
    await rm(sysfs, { recursive: true, force: true });
  });

  it('노트북 센서 값을 읽어 옴', async () => {
    sysfs = await fakeSysfs({
      'class/thermal/thermal_zone0/type': 'acpitz',
      'class/thermal/thermal_zone0/temp': '44000',
      'class/thermal/thermal_zone11/type': 'x86_pkg_temp',
      'class/thermal/thermal_zone11/temp': '37000',
      'class/power_supply/ACAD/type': 'Mains',
      'class/power_supply/ACAD/online': '1',
      'class/power_supply/BAT1/type': 'Battery',
      'class/power_supply/BAT1/capacity': '91',
      'class/power_supply/BAT1/status': 'Not charging',
      'class/power_supply/ucsi-source-psy-USBC000:001/type': 'USB',
    });
    process.env.SYSFS_ROOT = sysfs;
    app = await createApp();

    const res = await request(app.getHttpServer()).get('/api/server').expect(200);
    expect(res.body).toMatchObject({
      cpuTemp: 37,
      battery: { percent: 91, charging: false, pluggedIn: true },
      release: null,
    });
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.memoryUsedPercent).toBeGreaterThanOrEqual(0);
  });

  it('센서가 없으면 null', async () => {
    sysfs = await fakeSysfs({});
    process.env.SYSFS_ROOT = sysfs;
    app = await createApp();

    const res = await request(app.getHttpServer()).get('/api/server').expect(200);
    expect(res.body).toMatchObject({ cpuTemp: null, battery: null });
  });

  it('이미지에 넣어 둔 커밋과 빌드 시각을 꺼냄', () => {
    expect(readRelease({ RELEASE_COMMIT: '6cab207f4a71', RELEASE_BUILT_AT: '2026-10-11T05:49:32Z' })).toEqual({
      commit: '6cab207',
      deployedAt: '2026-10-11T05:49:32.000Z',
    });
    expect(readRelease({ RELEASE_COMMIT: 'af15ab4', RELEASE_BUILT_AT: 'nope' })).toEqual({ commit: 'af15ab4', deployedAt: null });
    expect(readRelease({})).toBeNull();
  });
});

describe('members', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('관리자와 주인장은 회원 목록을 보고, 주인장만 다른 회원을 관리자로 지정하거나 해제함', async () => {
    const server = app.getHttpServer();
    const ip = '203.0.113.170, 172.18.0.1';
    const join = async (email: string, name: string) => {
      await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
        .send({ email, name, password: 'correct horse battery staple' }).expect(202);
      const token = sentMail.findLast((mail) => mail.kind === 'verify' && mail.to === email)!.token;
      const res = await request(server).post('/api/community/auth/verify').set('X-Forwarded-For', ip).send({ token }).expect(200);
      return { cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], id: res.body.user.id as string };
    };
    const setRole = (email: string, role: string) => request(server).put('/api/community/admin/users/role')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ email, role }).expect(200);
    const owner = await join('members-owner@example.com', '주인');
    const admin = await join('members-admin@example.com', '운영');
    const member = await join('members-member@example.com', '회원');
    // 가입 확인을 마치지 않은 사람도 목록에 '확인 대기'로 보임
    await request(server).post('/api/community/auth/register').set('X-Forwarded-For', ip)
      .send({ email: 'members-pending@example.com', name: '대기', password: 'correct horse battery staple' }).expect(202);
    await setRole('members-owner@example.com', 'owner');
    await setRole('members-admin@example.com', 'admin');

    await request(server).get('/api/community/admin/members').expect(401);
    await request(server).get('/api/community/admin/members').set('Cookie', member.cookie).expect(403);
    const listed = await request(server).get('/api/community/admin/members').set('Cookie', admin.cookie).expect(200);
    expect(listed.headers['cache-control']).toBe('private, no-store');
    const byEmail = new Map(listed.body.members.map((row: { email: string }) => [row.email, row]));
    expect(byEmail.get('members-member@example.com')).toMatchObject({
      id: member.id, name: '회원', role: 'member', activeSessions: 1, verifiedAt: expect.any(String), lastLoginAt: expect.any(String),
    });
    expect(byEmail.get('members-pending@example.com')).toMatchObject({ verifiedAt: null, lastLoginAt: null, activeSessions: 0 });
    expect(byEmail.get('members-owner@example.com')).toMatchObject({ role: 'owner' });
    expect(listed.body.members[0]).not.toHaveProperty('passwordHash');
    expect(listed.body.limited).toBe(false);

    // 관리자는 보기만, 주인장만 바꿈. 주인장 자신, 다른 주인장, 확인 대기, 없는 회원은 못 바꿈
    const roleOf = (id: string, role: string, cookie: string) => request(server).patch(`/api/community/admin/members/${id}/role`)
      .set('Cookie', cookie).send({ role });
    await roleOf(member.id, 'admin', admin.cookie).expect(403);
    await roleOf(member.id, 'owner', owner.cookie).expect(400);
    await roleOf(owner.id, 'member', owner.cookie).expect(400);
    await roleOf('not-an-id', 'admin', owner.cookie).expect(404);
    const pendingId = (byEmail.get('members-pending@example.com') as { id: string }).id;
    await roleOf(pendingId, 'admin', owner.cookie).expect(404);
    await roleOf(member.id, 'admin', owner.cookie).set('Origin', 'https://evil.example').expect(403);
    expect((await roleOf(member.id, 'admin', owner.cookie).expect(200)).body.member).toMatchObject({ id: member.id, role: 'admin' });
    // 권한은 요청마다 역할에서 다시 계산하므로 이미 로그인한 세션에도 바로 반영됨
    await request(server).get('/api/community/admin/members').set('Cookie', member.cookie).expect(200);
    expect((await roleOf(member.id, 'member', owner.cookie).expect(200)).body.member.role).toBe('member');
    await request(server).get('/api/community/admin/members').set('Cookie', member.cookie).expect(403);
  });
});

describe('high-fives', () => {
  let app: INestApplication<App>;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('보낸 만큼 누적됨', async () => {
    const server = app.getHttpServer();
    const before = await request(server).get('/api/high-fives').expect(200);
    const res = await request(server).post('/api/high-fives').set('User-Agent', 'hi5-a').send({ count: 3 }).expect(200);
    expect(res.body).toEqual({ total: before.body.total + 3, accepted: 3 });
  });

  it('범위를 벗어난 횟수는 400', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/high-fives').send({ count: 0 }).expect(400);
    await request(server).post('/api/high-fives').send({ count: 11 }).expect(400);
    await request(server).post('/api/high-fives').send({ count: '3' }).expect(400);
  });

  it('한 사람이 하루 50번을 넘기면 넘친 만큼 세지 않음', async () => {
    const server = app.getHttpServer();
    const send = (count: number) =>
      request(server).post('/api/high-fives').set('User-Agent', 'hi5-limit').send({ count }).expect(200);
    for (let i = 0; i < 4; i++) await send(10);
    const almost = await send(8);
    expect(almost.body.accepted).toBe(8);
    const over = await send(5);
    expect(over.body.accepted).toBe(2);
    const blocked = await send(1);
    expect(blocked.body).toEqual({ total: over.body.total, accepted: 0 });
  });
});
