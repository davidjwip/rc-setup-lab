export interface AnalysisRoute {
  readonly view: 'analysis';
}

export interface GlossaryRoute {
  readonly view: 'glossary';
  readonly entryId?: string | undefined;
}

export type Route = AnalysisRoute | GlossaryRoute;

export function routeFromHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [head, ...rest] = raw.split('/');
  if (head !== 'glossary') return { view: 'analysis' };

  const entry = rest.join('/');
  if (entry === '') return { view: 'glossary' };

  let decoded = entry;
  try {
    decoded = decodeURIComponent(entry);
  } catch {
    decoded = entry;
  }
  return { view: 'glossary', entryId: decoded };
}

export function currentHash(): string {
  const location = (globalThis as { location?: { hash?: string } }).location;
  return typeof location?.hash === 'string' ? location.hash : '';
}
