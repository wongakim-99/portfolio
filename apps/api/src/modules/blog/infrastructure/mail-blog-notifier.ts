import { Injectable } from '@nestjs/common';
import { Mailer } from '../../../shared/infrastructure/mail/mailer.js';
import { UserDirectory } from '../../identity/index.js';
import { BlogNotifier } from '../domain/blog.ports.js';

// 열람 요청이 오면 주인장에게, 허락하면 요청한 사람에게, 증명 채점 하루 한도를 다 쓰면 주인장에게 메일. 기다리지 않고 보내고, 못 보내도 넘어감
@Injectable()
export class MailBlogNotifier extends BlogNotifier {
  constructor(
    private readonly mailer: Mailer,
    private readonly directory: UserDirectory,
  ) {
    super();
  }

  requestReceived(requesterName: string, postTitle: string): void {
    if (!this.mailer.ready) return;
    const url = this.mailer.link('/feed/admin#blog-requests');
    this.directory.owners()
      .then((owners) => Promise.all(owners.map((owner) => this.mailer.send(
        owner.email, '[김가원 블로그] 열람 요청', `${requesterName}님이 '${postTitle}' 글을 보고 싶어 합니다.\n\n관리실에서 허락하거나 거절할 수 있습니다.\n${url}`,
      ))))
      .catch(() => {});
  }

  granted(userId: string, grantedPostTitle: string | null, requestedPostId: string): void {
    if (!this.mailer.ready) return;
    const url = this.mailer.link(`/blog/posts/${requestedPostId}`);
    const what = grantedPostTitle ? `'${grantedPostTitle}' 글을` : '허락받은 사람만 보는 글을 모두';
    this.directory.contact(userId)
      .then((user) => user && this.mailer.send(
        user.email, '[김가원 블로그] 열람 요청이 허락되었습니다', `${user.name}님, 이제 ${what} 읽을 수 있습니다. 증명은 안 하셔도 됩니다.\n\n${url}`,
      ))
      .catch(() => {});
  }

  proofLimitReached(limit: number): void {
    if (!this.mailer.ready) return;
    const url = this.mailer.link('/feed/admin#blog-requests');
    this.directory.owners()
      .then((owners) => Promise.all(owners.map((owner) => this.mailer.send(
        owner.email, '[김가원 블로그] 오늘 증명 채점 한도를 다 썼습니다',
        `잠긴 글 증명 채점에서 오늘 바깥 AI 를 ${limit}번 불러 하루 한도에 닿았습니다.\n내일 0시(한국 시간)까지는 미리 적어 둔 채점평이 나가고 요금은 더 나가지 않습니다.\n\n봇이 두드리는 것일 수 있으니 관리실에서 오늘 횟수를 확인해 보세요.\n${url}`,
      ))))
      .catch(() => {});
  }
}
