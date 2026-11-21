import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { asObjectId, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import { MailTokenRepository, SessionRepository } from '../../domain/identity.ports.js';
import type { MailTokenKind } from '../../domain/session.js';
import { CommunitySession, CommunityToken } from './identity.schemas.js';

@Injectable()
export class MongoSessionRepository extends SessionRepository {
  constructor(@InjectModel(CommunitySession.name) private readonly sessions: Model<CommunitySession>) {
    super();
  }

  async create(tokenHash: string, userId: string, expiresAt: Date) {
    await this.sessions.create({ tokenHash, userId: asObjectId(userId), expiresAt });
  }

  async findUserId(tokenHash: string, now: Date) {
    const session = await this.sessions.findOne({ tokenHash, expiresAt: { $gt: now } }).lean();
    return session ? String(session.userId) : null;
  }

  async delete(tokenHash: string) {
    await this.sessions.deleteOne({ tokenHash });
  }

  async deleteAllFor(userId: string, exceptTokenHash?: string) {
    await this.sessions.deleteMany({
      userId: toObjectId(userId), ...(exceptTokenHash === undefined ? {} : { tokenHash: { $ne: exceptTokenHash } }),
    });
  }
}

// 가입 확인, 비밀번호 재설정 메일의 링크 토큰
@Injectable()
export class MongoMailTokenRepository extends MailTokenRepository {
  constructor(@InjectModel(CommunityToken.name) private readonly tokens: Model<CommunityToken>) {
    super();
  }

  async issue(userId: string, kind: MailTokenKind, tokenHash: string, expiresAt: Date) {
    const owner = asObjectId(userId);
    await this.tokens.deleteMany({ userId: owner, kind });
    await this.tokens.create({ userId: owner, kind, tokenHash, expiresAt });
  }

  async consume(tokenHash: string, kind: MailTokenKind, now: Date) {
    const saved = await this.tokens.findOneAndDelete({ tokenHash, kind, expiresAt: { $gt: now } }).lean();
    return saved ? String(saved.userId) : null;
  }

  async delete(tokenHash: string) {
    await this.tokens.deleteOne({ tokenHash });
  }

  async issuedSince(userId: string, kind: MailTokenKind, since: Date) {
    return Boolean(await this.tokens.exists({ userId: toObjectId(userId), kind, createdAt: { $gt: since } }));
  }
}
