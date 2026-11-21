import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

// 사이트 메일 보내기(네이버 SMTP). 무엇을 쓸지는 각 영역이 정하고 여기서는 보내기만 함
// 설정은 홈서버 ~/.config/portfolio/api.docker.env (README '피드 계정과 운영')
@Injectable()
export class Mailer {
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

  /** 메일 안의 링크. path 는 / 로 시작 */
  link(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transport) throw new ServiceUnavailableException('가입 메일 설정을 준비 중입니다.');
    await this.transport.sendMail({ from: `김가원 피드 <${this.user}>`, to, subject, text });
  }
}
