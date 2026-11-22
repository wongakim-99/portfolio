import { Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import { BlogNotifier, BlogPostRepository, ProofGrader, ProofUsageRepository } from '../domain/blog.ports.js';
import {
  plainVerdict, PROOF_DAILY_PER_VISITOR, PROOF_DAILY_TOTAL, PROOF_PROBLEMS, proofDay, proofForGrader,
} from '../domain/proof.js';

const POST_MISSING = '글을 찾을 수 없습니다.';
const LIMITS = { total: PROOF_DAILY_TOTAL, perVisitor: PROOF_DAILY_PER_VISITOR };
// 첫 글자가 이만큼 안 오면 기다리게 하지 않고 미리 적어 둔 채점평으로 넘김. 전체도 길게 끌지 않음
const FIRST_PIECE_MS = 8_000;
const TOTAL_MS = 20_000;

export interface ProofInput {
  problem: string;
  proof: string;
  attempt?: number;
}

// 잠긴 글의 '증명 제출' 채점. 채점평만 흘려보내고 글은 열지 않음
@Injectable()
export class ProofGradingService {
  constructor(
    private readonly posts: BlogPostRepository,
    private readonly grader: ProofGrader,
    private readonly usage: ProofUsageRepository,
    private readonly notifier: BlogNotifier,
  ) {}

  /** 관리실에 보여 줄 오늘 사용량 */
  async today() {
    const day = proofDay();
    return { day, total: await this.usage.total(day), limit: PROOF_DAILY_TOTAL, perVisitor: PROOF_DAILY_PER_VISITOR };
  }

  /** 채점평 조각. AI 를 못 쓰면(한도, 키 없음, 늦음, 오류) null */
  async grade(postId: string, input: ProofInput, visitor: string, signal: AbortSignal): Promise<AsyncIterable<string> | null> {
    const post = await this.posts.findById(requireEntityId(postId, POST_MISSING));
    // 문제는 잠긴 글에만 냄. 나만 보기 글은 있는지도 알리지 않음
    if (post?.visibility !== 'approved') throw new NotFoundException(POST_MISSING);
    const problem = PROOF_PROBLEMS[input.problem];
    if (!problem || !(await this.take(visitor))) return null;

    const late = new AbortController();
    const stop = AbortSignal.any([signal, late.signal, AbortSignal.timeout(TOTAL_MS)]);
    const opened = this.grader.grade({ problem, proof: proofForGrader(input.proof), attempt: input.attempt ?? 1 }, stop).then(async (pieces) => {
      if (!pieces) return null;
      const iterator = pieces[Symbol.asyncIterator]();
      const first = await iterator.next();
      return first.done ? null : { iterator, first: first.value };
    });
    let timer: NodeJS.Timeout | undefined;
    const tooLate = new Promise<null>((resolve) => {
      timer = setTimeout(resolve, FIRST_PIECE_MS, null);
    });
    const head = await Promise.race([opened, tooLate]).catch(() => null).finally(() => clearTimeout(timer));
    if (!head) {
      late.abort();
      opened.catch(() => {});
      return null;
    }
    return (async function* () {
      yield plainVerdict(head.first);
      for (let next = await head.iterator.next(); !next.done; next = await head.iterator.next()) yield plainVerdict(next.value);
    })();
  }

  // 사람마다, 사이트 전체로 하루 몇 번까지만 바깥 AI 를 부름. 횟수는 DB 에 남아 배포해도 이어서 셈
  // 전체 한도에 딱 닿는 한 번에만 주인장에게 알림 (그 뒤 요청은 한도에 막혀 여기까지 오지 않음)
  private async take(visitor: string): Promise<boolean> {
    const total = await this.usage.take(proofDay(), visitor, LIMITS);
    if (total === null) return false;
    if (total === PROOF_DAILY_TOTAL) this.notifier.proofLimitReached(PROOF_DAILY_TOTAL);
    return true;
  }
}
