import { useEffect, useMemo, useState } from 'react';
import { filterEntries, glossaryEntries } from './entries.js';

export interface GlossaryViewProps {
  readonly entryId?: string | undefined;
  readonly initialQuery?: string | undefined;
}

export function GlossaryView({ entryId, initialQuery = '' }: GlossaryViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const filtered = useMemo(() => filterEntries(glossaryEntries, query), [query]);

  useEffect(() => {
    if (entryId === undefined) return;
    document.getElementById(entryId)?.scrollIntoView({ block: 'start' });
  }, [entryId]);

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-row">
          <p className="eyebrow">Setup Lab · Glossary</p>
          <a className="text-link" href="#analysis">
            Back to the drawing
          </a>
        </div>
        <h1>Glossary</h1>
        <p className="lede">The quantities the app uses, what each one is, and where it surfaces.</p>
      </header>

      <section className="glossary-panel" aria-label="Glossary entries">
        <div className="glossary-search">
          <label className="glossary-search-label" htmlFor="glossary-search">
            Search
          </label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Term or phrase"
          />
          {query === '' ? null : (
            <button type="button" className="glossary-clear" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="glossary-empty">
            <p role="status">Nothing matched “{query}”.</p>
            <button type="button" className="glossary-clear" onClick={() => setQuery('')}>
              Show all entries
            </button>
          </div>
        ) : (
          <dl className="glossary-list">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                id={entry.id}
                className={`glossary-entry${entryId === entry.id ? ' is-active' : ''}`}
                data-glossary-id={entry.id}
                data-active={entryId === entry.id ? 'true' : 'false'}
              >
                <dt>{entry.term}</dt>
                <dd>
                  <p className="glossary-oneliner">{entry.oneLiner}</p>
                  <p className="glossary-racer">{entry.racerSentence}</p>
                  <p className="glossary-where">
                    <span>Where it surfaces:</span> {entry.where}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </main>
  );
}
