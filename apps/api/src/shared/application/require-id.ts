import { NotFoundException } from '@nestjs/common';
import { isEntityId } from '../domain/entity-id.js';

/** 주소로 받은 ID 의 모양이 틀리면 없는 것으로 보고 404 */
export function requireEntityId(value: string, missing: string): string {
  if (!isEntityId(value)) throw new NotFoundException(missing);
  return value;
}
