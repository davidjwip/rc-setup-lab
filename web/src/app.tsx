import { useEffect, useMemo, useRef, useState } from 'react';
import { parseCarModel, type CarModelDocument, type DataError } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { GlossaryView } from './glossary/GlossaryView.js';
import { GeometryPage } from './pages/GeometryPage.js';
import { HomePage } from './pages/HomePage.js';
import { ShockPage } from './pages/ShockPage.js';
import { TransferPage } from './pages/TransferPage.js';
import {
  PAGE_KEYS,
  PAGE_LABELS,
  currentHash,
  hashForPage,
  routeFromHash,
  type PageKey,
  type Route,
} from './route.js';
import { createSetupStore, useSetupStore } from './state/setupStore.js';

function ParseErrors({ errors }: { readonly errors: readonly DataError[] }) {
  return (
    <main className="shell">
      <h1>Setup Lab</h1>
      <section className="card error-card">
        <h2>That model did not load</h2>
        <ul>
          {errors.map((error) => (
            <li key={`${error.code}:${error.path}`}>
              <code>{error.path || 'document'}</code>: {error.message}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PageNav({ route }: { readonly route: Route }) {
  const currentPage = route.view === 'page' ? route.page : null;
  return (
    <nav className="page-nav" aria-label="Setup Lab pages">
      {PAGE_KEYS.map((page) => (
        <a
          key={page}
          href={hashForPage(page)}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {PAGE_LABELS[page]}
        </a>
      ))}
      <a href="#glossary" aria-current={route.view === 'glossary' ? 'page' : undefined}>
        Glossary
      </a>
    </nav>
  );
}

function AppWithStore({ baseline }: { readonly baseline: CarModelDocument }) {
  const [store] = useState(() => createSetupStore({ baseline }));
  const snapshot = useSetupStore(store);
  const [route, setRoute] = useState<Route>(() => routeFromHash(currentHash()));
  const lastPage = useRef<PageKey>(route.view === 'page' ? route.page : 'home');

  useEffect(() => {
    const onHashChange = () => {
      setRoute((current) => {
        if (current.view === 'page') lastPage.current = current.page;
        return routeFromHash(currentHash());
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  let page;
  if (route.view === 'glossary') {
    page = (
      <GlossaryView entryId={route.entryId} backHref={hashForPage(lastPage.current)} />
    );
  } else if (route.page === 'geometry') {
    page = <GeometryPage store={store} />;
  } else if (route.page === 'shock') {
    page = <ShockPage store={store} />;
  } else if (route.page === 'transfer') {
    page = <TransferPage store={store} />;
  } else {
    page = <HomePage store={store} />;
  }

  return (
    <>
      <PageNav route={route} />
      {snapshot.edited ? (
        <div className="session-badge" role="status">
          <span>edited this session</span>
          <button type="button" className="revert-button" onClick={store.revertAll}>
            Revert to baseline
          </button>
        </div>
      ) : null}
      {page}
    </>
  );
}

export function App() {
  const parsed = useMemo(() => parseCarModel(rawModel), []);
  if (!parsed.ok) return <ParseErrors errors={parsed.errors} />;
  return <AppWithStore baseline={parsed.value} />;
}
