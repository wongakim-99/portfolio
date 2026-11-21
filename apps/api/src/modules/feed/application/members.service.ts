import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../../../shared/events/domain-events.js';
import { ProfileService, UserDirectory, type Identity } from '../../identity/index.js';
import { CommentRepository, PostRepository } from '../domain/feed.ports.js';

// 회원 페이지: 계정 영역의 공개 프로필에 피드에서 쓴 글, 댓글 수를 붙임
// 이름이 바뀌면(user.renamed) 그동안 쓴 글과 댓글의 글쓴이 이름도 고침
@Injectable()
export class MembersService implements OnModuleInit {
  constructor(
    private readonly posts: PostRepository,
    private readonly comments: CommentRepository,
    private readonly directory: UserDirectory,
    private readonly profiles: ProfileService,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('user.renamed', async ({ userId, name }) => {
      await Promise.all([this.posts.renameAuthor(userId, name), this.comments.renameAuthor(userId, name)]);
    });
  }

  async profile(id: string) {
    const profile = await this.directory.publicProfile(id);
    if (!profile) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    const [postCount, commentCount] = await Promise.all([this.posts.countByAuthor(profile.id), this.comments.countByAuthor(profile.id)]);
    return { ...profile, postCount, commentCount };
  }

  async updateProfile(identity: Identity, input: { name: string; bio: string }) {
    await this.profiles.update(identity, input);
    return this.profile(identity.id);
  }
}
