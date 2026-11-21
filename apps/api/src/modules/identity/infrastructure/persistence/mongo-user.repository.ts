import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isDuplicateKey, toObjectId } from '../../../../shared/infrastructure/mongo.js';
import { UserRepository } from '../../domain/identity.ports.js';
import type { Role } from '../../domain/role.js';
import type { User } from '../../domain/user.js';
import { CommunityUser } from './identity.schemas.js';

type UserDoc = CommunityUser & { _id: unknown };

const toUser = (doc: UserDoc): User => ({
  id: String(doc._id), email: doc.email, name: doc.name, passwordHash: doc.passwordHash, role: doc.role ?? 'member',
  bio: doc.bio ?? '', avatar: doc.avatar ?? null, verifiedAt: doc.verifiedAt ?? null, createdAt: doc.createdAt,
});
const verified = { verifiedAt: { $ne: null } };

@Injectable()
export class MongoUserRepository extends UserRepository {
  constructor(@InjectModel(CommunityUser.name) private readonly users: Model<CommunityUser>) {
    super();
  }

  async deleteExpiredPending(email: string, now: Date) {
    await this.users.deleteOne({ email, verifiedAt: null, pendingExpiresAt: { $lt: now } });
  }

  async existsByEmail(email: string) {
    return Boolean(await this.users.exists({ email }));
  }

  async createPending(input: { email: string; name: string; passwordHash: string; pendingExpiresAt: Date }) {
    try {
      const user = await this.users.create({ ...input, verifiedAt: null });
      return toUser(user.toObject());
    } catch (error) {
      if (isDuplicateKey(error)) return null;
      throw error;
    }
  }

  async deleteUnverified(id: string) {
    await this.users.deleteOne({ _id: toObjectId(id), verifiedAt: null });
  }

  async markVerified(id: string) {
    const user = await this.users.findByIdAndUpdate(toObjectId(id), {
      $set: { verifiedAt: new Date() }, $unset: { pendingExpiresAt: 1 },
    }, { returnDocument: 'after' }).lean();
    return user && toUser(user);
  }

  async findByEmail(email: string) {
    const user = await this.users.findOne({ email }).lean();
    return user && toUser(user);
  }

  async findPendingByEmail(email: string, now: Date) {
    const user = await this.users.findOne({ email, verifiedAt: null, pendingExpiresAt: { $gt: now } }).lean();
    return user && toUser(user);
  }

  async findVerifiedByEmail(email: string) {
    const user = await this.users.findOne({ email, ...verified }).lean();
    return user && toUser(user);
  }

  async findById(id: string) {
    const _id = toObjectId(id);
    const user = _id && await this.users.findById(_id).lean();
    return user ? toUser(user) : null;
  }

  async findVerifiedById(id: string) {
    const _id = toObjectId(id);
    const user = _id && await this.users.findOne({ _id, ...verified }).lean();
    return user ? toUser(user) : null;
  }

  async findVerifiedByIds(ids: string[]) {
    const users = await this.users.find({ _id: { $in: ids.map(toObjectId) }, ...verified }).lean();
    return users.map(toUser);
  }

  async findOwners() {
    const users = await this.users.find({ role: 'owner', ...verified }).sort({ _id: 1 }).lean();
    return users.map(toUser);
  }

  async setPasswordHash(id: string, passwordHash: string, verifiedOnly = false) {
    await this.users.updateOne({ _id: toObjectId(id), ...(verifiedOnly ? verified : {}) }, { $set: { passwordHash } });
  }

  async updateProfile(id: string, profile: { name: string; bio: string }) {
    await this.users.updateOne({ _id: toObjectId(id) }, { $set: profile });
  }

  async setRoleByEmail(email: string, role: Role) {
    const user = await this.users.findOneAndUpdate({ email, ...verified }, { $set: { role } }, { returnDocument: 'after' }).lean();
    return user && toUser(user);
  }

  async setAvatar(id: string, avatar: string | null) {
    const before = await this.users.findOneAndUpdate(
      { _id: toObjectId(id) }, { $set: { avatar } }, { projection: { avatar: 1 }, returnDocument: 'before' },
    ).lean();
    return before?.avatar ?? null;
  }
}
