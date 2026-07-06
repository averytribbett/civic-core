export function openWidget() {
  if (window.CivicCore?.open) {
    window.CivicCore.open();
    return;
  }

  document.querySelector<HTMLButtonElement>('.civiccore-widget-btn')?.click();
}
