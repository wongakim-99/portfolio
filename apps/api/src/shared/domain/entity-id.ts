// 모든 영역의 문서 ID 는 Mongo ObjectId 를 24자리 16진수 글자로 다룸
// 도메인, 응용 계층은 Mongo 를 모르므로 모양만 확인하고, 변환은 각 영역의 infrastructure 가 함
const ENTITY_ID = /^[a-f\d]{24}$/i;

export const isEntityId = (value: string): boolean => ENTITY_ID.test(value);
