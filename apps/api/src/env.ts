export interface Env {
  MONGODB_URI: string;
  ADMIN_TOKEN: string;
  HASH_SALT: string;
}

const REQUIRED = ['MONGODB_URI', 'ADMIN_TOKEN', 'HASH_SALT'] as const;

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(`환경변수 누락: ${missing.join(', ')}`);
  }
  if (String(raw.ADMIN_TOKEN).length < 24) {
    throw new Error('ADMIN_TOKEN 은 24자 이상이어야 함');
  }
  return raw;
}
