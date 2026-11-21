import { Types } from 'mongoose';
import { isEntityId } from '../domain/entity-id.js';

// 저장소 구현(infrastructure)이 같이 쓰는 Mongo 도우미

/** 글자 ID 를 ObjectId 로. 모양이 틀리면 null 이라 '없는 문서'로 다룸 */
export const toObjectId = (id: string): Types.ObjectId | null => (isEntityId(id) ? new Types.ObjectId(id) : null);

/** 응용 계층이 이미 확인한 ID 를 저장할 때. 모양이 틀리면 프로그램 오류라 그대로 실패함 */
export const asObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

/** 유일 인덱스에 걸린 중복 저장 */
export const isDuplicateKey = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
