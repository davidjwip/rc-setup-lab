export const PAGE_KEYS = ['home', 'geometry', 'shock', 'transfer'] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Readonly<Record<PageKey, string>> = {
  home: 'Home',
  geometry: 'Geometry',
  shock: 'Shock',
  transfer: 'Transfer',
};

export interface PageRoute {
  readonly view: 'page';
  readonly page: PageKey;
}

export interface GlossaryRoute {
  readonly view: 'glossary';
  readonly entryId?: string | undefined;
}

export type Route = PageRoute | GlossaryRoute;

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

export function hashForPage(page: PageKey): string {
  return `#${page}`;
}

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

  if (head !== undefined && isPageKey(head)) return { view: 'page', page: head };
  return { view: 'page', page: 'home' };
}

export function currentHash(): string {
  const location = (globalThis as { location?: { hash?: string } }).location;
  return typeof location?.hash === 'string' ? location.hash : '';
}
