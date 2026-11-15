import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class CommunityMailService {
  private readonly user = process.env.COMMUNITY_SMTP_USER;
  private readonly password = process.env.COMMUNITY_SMTP_PASSWORD;
  private readonly baseUrl = process.env.COMMUNITY_BASE_URL;
  private readonly host = process.env.COMMUNITY_SMTP_HOST || 'smtp.naver.com';
  readonly ready = Boolean(this.user && this.password && this.baseUrl && /^https:\/\//.test(this.baseUrl));

  private readonly transport = this.ready ? nodemailer.createTransport({
    host: this.host,
    port: Number(process.env.COMMUNITY_SMTP_PORT || 465),
    secure: Number(process.env.COMMUNITY_SMTP_PORT || 465) === 465,
    auth: {
      user: this.host === 'smtp.naver.com' ? this.user!.replace(/@naver\.com$/i, '') : this.user!,
      pass: this.password!,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  }) : null;

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transport) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    await this.transport.sendMail({ from: `김가원 피드 <${this.user}>`, to, subject, text });
  }

  async sendVerify(to: string, name: string, token: string): Promise<void> {
    const url = `${this.baseUrl}/community.html#verify=${token}`;
    await this.send(to, '[김가원 피드] 이메일 확인', `${name}님, 아래 주소를 열어 이메일을 확인해 주세요.\n\n${url}\n\n이 링크는 1시간 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`);
  }

  async sendReset(to: string, name: string, token: string): Promise<void> {
    const url = `${this.baseUrl}/community.html#reset=${token}`;
    await this.send(to, '[김가원 피드] 비밀번호 재설정', `${name}님, 아래 주소에서 새 비밀번호를 정해 주세요.\n\n${url}\n\n이 링크는 30분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`);
  }
}
