import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

interface Hit {
  text: string;
  source: string;
  section: string;
  corpus: string;
  url: string;
}

/**
 * A small "ask the AiiDA docs" box: semantic search over the documentation,
 * served by the aiida-agents RAG endpoint via the /api/ask Pages Function.
 * Retrieval only, it returns the closest doc sections with links, no LLM.
 */
export default function AskDocs() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setHits(null);
    try {
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 5 }),
      });
      if (!resp.ok) {
        throw new Error(
          resp.status === 503
            ? 'The documentation index is not available yet.'
            : `Search failed (${resp.status}).`,
        );
      }
      const data = (await resp.json()) as { results?: Hit[] };
      setHits(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ask-root">
      <form className="ask-form" onSubmit={search}>
        <input
          className="ask-input"
          type="search"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Ask the AiiDA docs, e.g. how do I restart a work chain?"
          aria-label="Search the AiiDA documentation"
        />
        <button className="ask-button" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="ask-message ask-message--error">{error}</p>}
      {hits && hits.length === 0 && !error && (
        <p className="ask-message">No matching documentation found.</p>
      )}

      {hits && hits.length > 0 && (
        <ul className="ask-results">
          {hits.map((hit, i) => {
            const label = hit.section ? `${hit.source} § ${hit.section}` : hit.source;
            return (
              <li className="ask-result" key={`${hit.source}-${i}`}>
                {hit.url ? (
                  <a
                    className="ask-result-title"
                    href={hit.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                ) : (
                  <span className="ask-result-title">{label}</span>
                )}
                <p className="ask-result-text">{hit.text}</p>
                <span className="ask-result-corpus">{hit.corpus}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
