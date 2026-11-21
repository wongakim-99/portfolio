// 같은 주소의 /api 로 보냄. 운영에서는 Caddy 가, 로컬에서는 next.config.ts 의 rewrites 가 API 로 넘겨 줌
// API 가 실패해도 페이지 본문은 그대로 보이도록, 부르는 쪽에서 실패를 조용히 넘길 수 있게 둠

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return (await response.json()) as T;
}

/** 응답 코드마다 다른 안내를 보여 주는 곳이 있어서 Response 를 그대로 돌려줌 */
export function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
