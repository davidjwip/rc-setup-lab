import { PlaceholderPage, type PageProps } from './PageShell.js';

export function GeometryPage({ store }: PageProps) {
  return (
    <PlaceholderPage
      title="Geometry"
      summary="Roll centre, camber gain and toe gain, with the drawing above the settings."
      store={store}
    />
  );
}
