import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from '../domain/identity.ports.js';

const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = '75a01a8965ae6ecda2a65c3829c20abd';

async function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

// 비밀번호는 scrypt 로 해시해 'salt:해시' 로 저장함
@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${(await derive(password, salt)).toString('hex')}`;
  }

  async verify(password: string, saved?: string | null): Promise<boolean> {
    const [salt, expectedHex] = saved?.split(':') ?? [DUMMY_SALT, '0'.repeat(128)];
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, Buffer.from(expectedHex, 'hex')) && Boolean(saved);
  }
}
