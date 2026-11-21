/** 배포에 걸린 시간: 48초, 1분 12초 */
export function formatDeployDuration(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  const rest = seconds % 60;
  return rest ? `${Math.floor(seconds / 60)}분 ${rest}초` : `${seconds / 60}분`;
}
