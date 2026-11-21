// DTO 에서 같이 쓰는 입력 다듬기 (class-transformer 의 @Transform 에 넘김)
type Input = { value: unknown };

export const trim = ({ value }: Input) => (typeof value === 'string' ? value.trim() : value);
/** 앞뒤 공백을 떼고 줄바꿈과 연속 공백을 한 칸으로 */
export const oneLine = ({ value }: Input) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
export const lowerEmail = ({ value }: Input) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
