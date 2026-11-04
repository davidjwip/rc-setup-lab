import { isAnalysisMode, type AnalysisMode } from './view/viewMode.js';

export interface AnalysisRoute {
  readonly view: 'analysis';
  readonly mode?: AnalysisMode | undefined;
}

export interface GlossaryRoute {
  readonly view: 'glossary';
  readonly entryId?: string | undefined;
}

export type Route = AnalysisRoute | GlossaryRoute;

export function routeFromHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [head, ...rest] = raw.split('/');
  if (head === 'glossary') {
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

  if (head !== undefined && isAnalysisMode(head)) return { view: 'analysis', mode: head };

  return { view: 'analysis' };
}

export function currentHash(): string {
  const location = (globalThis as { location?: { hash?: string } }).location;
  return typeof location?.hash === 'string' ? location.hash : '';
}
