export {};

declare global {
  interface CivicCoreWidgetConfig {
    source: string;
    name?: string;
    logo?: string;
    theme?: { color?: string };
    widgetUrl?: string;
    apiBaseUrl?: string;
    align?: 'left' | 'right';
  }

  interface CivicCoreApi {
    open: () => void;
    close: () => void;
    toggle: () => void;
  }

  interface Window {
    CivicCoreWidget?: CivicCoreWidgetConfig;
    CivicCore?: CivicCoreApi;
  }
}
