// 피드 API(/api/community)와 블로그 API(/api/blog) 호출. 로그인은 HttpOnly 쿠키라 같은 주소에서만 보냄

const FALLBACK_MESSAGE = '요청을 처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 사진처럼 본문을 그대로 보낼 때. Content-Type 은 파일 형식을 씀 */
  file?: Blob;
}

async function sessionRequest<T>(url: string, { method = 'GET', body, file }: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: file ? { 'Content-Type': file.type } : body ? { 'Content-Type': 'application/json' } : undefined,
    body: file ?? (body ? JSON.stringify(body) : undefined),
  });
  if (response.status === 204) return null as T;
  const data = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    throw new ApiError(message || FALLBACK_MESSAGE, response.status);
  }
  return data as T;
}

export const communityRequest = <T>(path: string, options?: RequestOptions) => sessionRequest<T>(`/api/community${path}`, options);
export const blogRequest = <T>(path: string, options?: RequestOptions) => sessionRequest<T>(`/api/blog${path}`, options);

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : FALLBACK_MESSAGE);
export const errorStatus = (error: unknown) => (error instanceof ApiError ? error.status : 0);
