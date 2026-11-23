import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { requireEntityId } from '../../../shared/application/require-id.js';
import type { Identity } from '../../identity/index.js';
import type { ReportReason, ReportTarget } from '../domain/feed.js';
import { CommentRepository, PostRepository, ReportRepository } from '../domain/feed.ports.js';

const REPORTS_FOR_ADMIN = 100;

// 신고와 관리실의 신고 목록
@Injectable()
export class ModerationService {
  constructor(
    private readonly posts: PostRepository,
    private readonly comments: CommentRepository,
    private readonly reports: ReportRepository,
  ) {}

  async report(input: { targetType: ReportTarget; targetId: string; reason: ReportReason }, reporter: Identity): Promise<void> {
    const targetId = requireEntityId(input.targetId, '글을 찾을 수 없습니다.');
    const exists = input.targetType === 'post' ? await this.posts.exists(targetId) : await this.comments.exists(targetId);
    if (!exists) throw new NotFoundException('신고할 내용을 찾을 수 없습니다.');
    const created = await this.reports.create({ reporterId: reporter.id, targetType: input.targetType, targetId, reason: input.reason });
    if (!created) throw new ConflictException('이미 신고한 내용입니다.');
  }

  // 관리실에서 무엇이 신고됐는지 바로 보이도록 글 제목(짧은 글은 본문 앞부분)이나 답글 앞부분을 함께 줌
  async reportsForAdmin() {
    const reports = await this.reports.latest(REPORTS_FOR_ADMIN);
    const idsOf = (type: ReportTarget) => reports.filter((report) => report.targetType === type).map((report) => report.targetId);
    const [posts, comments] = await Promise.all([this.posts.findMany(idsOf('post')), this.comments.findMany(idsOf('comment'))]);
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
    return reports.map((report) => {
      const post = report.targetType === 'post' ? postsById.get(report.targetId) : undefined;
      const comment = report.targetType === 'comment' ? commentsById.get(report.targetId) : undefined;
      return {
        id: report.id, targetType: report.targetType, targetId: report.targetId, reason: report.reason, createdAt: report.createdAt,
        target: post ? { postId: post.id, authorName: post.authorName, text: post.title || post.body.slice(0, 160) || '(사진만 올린 글)' }
          : comment ? { postId: comment.postId, authorName: comment.authorName, text: comment.body.slice(0, 160) }
          : null,
      };
    });
  }

  reportCount(): Promise<number> {
    return this.reports.count();
  }

  async dismissReport(id: string): Promise<void> {
    if (!(await this.reports.delete(requireEntityId(id, '글을 찾을 수 없습니다.')))) throw new NotFoundException('신고를 찾을 수 없습니다.');
  }
}
