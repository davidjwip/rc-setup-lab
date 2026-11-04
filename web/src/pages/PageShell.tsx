import type { SetupStore } from '../state/setupStore.js';

export interface PageProps {
  readonly store: SetupStore;
}

export function PlaceholderPage({
  title,
  summary,
}: {
  readonly title: string;
  readonly summary: string;
  readonly store: SetupStore;
}) {
  return (
    <main className="shell" data-page={title.toLowerCase()}>
      <header className="masthead">
        <p className="eyebrow">Setup Lab</p>
        <h1>{title}</h1>
        <p className="lede">{summary}</p>
      </header>
      <section className="card placeholder-card">
        <h2>This page is coming in the next slice</h2>
        <p className="hint">
          The page shell, routing and the shared model document are in place. The diagrams and
          setting controls for this page arrive in the next slice.
        </p>
      </section>
    </main>
  );
}

