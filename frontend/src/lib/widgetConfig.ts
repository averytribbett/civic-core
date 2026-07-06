const WIDGET_ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : '';

export const WIDGET_ACCENT = '#F0801A';

export function getWidgetConfig() {
  return {
    source: 'chisago_county_mn',
    name: 'Chisago county',
    logo: 'https://www.chisagocountymn.gov/ImageRepository/Document?documentID=22423',
    theme: { color: WIDGET_ACCENT },
    widgetUrl: `${WIDGET_ORIGIN}/widget/app/widget.html`,
  };
}

export function loadWidgetScript() {
  if (document.querySelector('script[data-civiccore-widget]')) return;

  window.CivicCoreWidget = getWidgetConfig();

  const script = document.createElement('script');
  script.src = `${WIDGET_ORIGIN}/widget/widget.js`;
  script.async = true;
  script.dataset.civiccoreWidget = 'true';
  document.body.appendChild(script);
}
