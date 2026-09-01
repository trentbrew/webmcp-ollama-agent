export type PageVariant = 'settings' | 'browse' | 'fullBleed' | 'prose';

export interface VariantConfig {
  padding: string;
  scroll: boolean;
  showHeader: boolean;
}

export const VARIANT_CONFIG: Record<PageVariant, VariantConfig> = {
  settings: { padding: 'px-3 py-3', scroll: true, showHeader: true },
  browse: { padding: 'px-3 py-3', scroll: true, showHeader: true },
  fullBleed: { padding: 'p-0', scroll: false, showHeader: false },
  prose: { padding: 'px-3 py-4', scroll: true, showHeader: true },
};
