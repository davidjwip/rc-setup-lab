import { PlaceholderPage, type PageProps } from './PageShell.js';

export function TransferPage({ store }: PageProps) {
  return (
    <PlaceholderPage
      title="Transfer"
      summary="Load transfer, balance and chassis roll sensitivity, with the CG route stated."
      store={store}
    />
  );
}
