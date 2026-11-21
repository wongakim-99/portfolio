import { legacyFeedPath } from './legacy-path';

export function GET(request: Request) {
  const url = new URL(request.url);
  return new Response(null, { status: 308, headers: { Location: legacyFeedPath(url.searchParams) } });
}
