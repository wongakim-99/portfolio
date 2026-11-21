// 홈의 하이파이브. 연타를 모아 보내고, 한 사람(IP + 브라우저 해시)이 하루에 올릴 수 있는 수에 한도가 있음
export const HIGH_FIVE_PAGE = 'home';
export const DAILY_LIMIT = 50;

/** 오늘 이미 보낸 수(sentToday)를 포함해 이번에 받을 수 있는 만큼. 넘친 만큼은 세지 않음 */
export function acceptedHighFives(sentToday: number, count: number): number {
  const over = Math.max(0, sentToday - DAILY_LIMIT);
  return Math.max(0, count - over);
}

export abstract class HighFiveRepository {
  /** 이 방문자의 오늘 수를 count 만큼 늘리고 늘어난 뒤의 수를 돌려줌 */
  abstract addToDaily(visitor: string, day: string, count: number): Promise<number>;
  abstract addToTotal(page: string, count: number): Promise<number>;
  abstract total(page: string): Promise<number>;
}
