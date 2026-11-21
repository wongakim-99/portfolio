import { Injectable } from '@nestjs/common';
import { Mailer } from '../../../shared/infrastructure/mail/mailer.js';
import { IdentityMailer } from '../domain/identity.ports.js';

// 가입 확인과 비밀번호 재설정 메일. 링크의 토큰은 # 뒤에 둬서 서버 로그에 남지 않음
@Injectable()
export class MailIdentityMailer extends IdentityMailer {
  constructor(private readonly mailer: Mailer) {
    super();
  }

  get ready(): boolean {
    return this.mailer.ready;
  }

  async sendVerify(to: string, name: string, token: string): Promise<void> {
    const url = this.mailer.link(`/feed#verify=${token}`);
    await this.mailer.send(to, '[김가원 피드] 이메일 확인', `${name}님, 아래 주소를 열어 이메일을 확인해 주세요.\n\n${url}\n\n이 링크는 1시간 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`);
  }

  async sendReset(to: string, name: string, token: string): Promise<void> {
    const url = this.mailer.link(`/feed#reset=${token}`);
    await this.mailer.send(to, '[김가원 피드] 비밀번호 재설정', `${name}님, 아래 주소에서 새 비밀번호를 정해 주세요.\n\n${url}\n\n이 링크는 30분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`);
  }
}
