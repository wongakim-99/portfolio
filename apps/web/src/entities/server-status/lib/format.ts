import type { ServerStatus } from '../model/types';

export function formatBattery(battery: ServerStatus['battery']) {
  if (!battery) return '없음';
  if (battery.charging) return `${battery.percent}% 충전 중`;
  if (battery.pluggedIn === false) return `${battery.percent}% 배터리로 버티는 중`;
  if (battery.pluggedIn) return `${battery.percent}% 전원 연결`;
  return `${battery.percent}%`;
}
