import { postJson } from '@shared/api';

export interface MessageInput {
  name: string;
  email?: string;
  message: string;
  /** 사람에게는 안 보이는 봇 차단 칸(honeypot). 사람이 보낼 때는 비워 둠 */
  website?: string;
}

/** 홈 엽서와 숨은 터미널(mail gawon)이 보내는 쪽지. 응답 코드마다 안내가 달라서 Response 를 그대로 돌려줌 */
export const sendMessage = (input: MessageInput) => postJson('/messages', input);

/** POST /api/messages 응답 코드별 안내 */
export const SEND_RESULT_TEXT: Record<number, string> = {
  201: '보냈어요. 남겨 주셔서 고맙습니다.',
  400: '입력한 내용을 다시 확인해 주세요. 메시지는 5자 이상이어야 해요.',
  429: '잠시 뒤에 다시 보내 주세요.',
};
export const SEND_FALLBACK_TEXT = '지금은 보낼 수 없어요. 메일로 연락해 주세요.';
