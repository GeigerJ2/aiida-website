/**
 * Cloudflare Pages Function: proxy the docs "ask" box to the aiida-agents RAG
 * search service (`aiida-agents rag serve`). The browser calls this site's own
 * same-origin /api/ask, so the backend URL is never exposed to the client and
 * rate limiting / caching can live here at the edge.
 *
 * Configure the backend in the Cloudflare Pages project settings as an
 * environment variable RAG_BACKEND_URL, e.g. https://rag.aiida.net (the base
 * URL of the running `rag serve`; this function appends /search).
 */

interface Env {
  RAG_BACKEND_URL: string;
}

interface AskBody {
  query?: unknown;
  limit?: unknown;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  if (!env.RAG_BACKEND_URL) {
    return json({ error: 'Documentation search is not configured.' }, 500);
  }

  let body: AskBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return json({ error: 'A non-empty "query" is required.' }, 400);
  }
  const limit =
    typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.trunc(body.limit), 1), 20)
      : 5;

  const backend = env.RAG_BACKEND_URL.replace(/\/$/, '');
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
  } catch {
    return json({ error: 'The documentation search service is unreachable.' }, 502);
  }

  // Pass the upstream status and body straight through: 200 with results, or
  // 503 when the index is not built. The browser only ever sees this origin.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
