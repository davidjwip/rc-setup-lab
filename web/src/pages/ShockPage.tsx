import { PlaceholderPage, type PageProps } from './PageShell.js';

export function ShockPage({ store }: PageProps) {
  return (
    <PlaceholderPage
      title="Shock"
      summary="Springs, dampers and anti-roll bars, with their derived rates below the diagram."
      store={store}
    />
  );
}
