import { Injectable } from '@nestjs/common';
import type { Identity } from '../../identity/index.js';
import { grantsFrom, NO_GRANTS, type Reader, type ReaderGrants } from '../domain/blog.js';
import { GrantRepository } from '../domain/blog.ports.js';

/** 로그인한 사람을 블로그의 읽는 사람으로. 주인장은 blog:write 권한으로 알아봄 */
export const readerOf = (identity: Identity | null): Reader =>
  identity && { id: identity.id, owner: identity.permissions.includes('blog:write') };

@Injectable()
export class ReaderAccess {
  constructor(private readonly grants: GrantRepository) {}

  async grantsOf(reader: Reader): Promise<ReaderGrants> {
    return reader ? grantsFrom(await this.grants.forUser(reader.id)) : NO_GRANTS;
  }
}
