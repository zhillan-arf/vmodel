export type StudioView = 'studio' | 'library' | 'tracking';
export function createNavigation(onChange: (view: StudioView) => void) {
  const nav = document.createElement('nav'); nav.className = 'studio-nav'; nav.setAttribute('aria-label','Studio views');
  let current: StudioView = 'studio';
  const select = (view: StudioView) => {
    current = view; document.body.dataset.view = view;
    for (const button of nav.querySelectorAll('button')) button.setAttribute('aria-current',String(button.dataset.view === view));
    for (const panel of document.querySelectorAll<HTMLElement>('[data-studio-panel]')) panel.hidden = panel.dataset.studioPanel !== view;
    onChange(view);
  };
  for (const view of ['studio','library','tracking'] as const) {
    const button = document.createElement('button'); button.textContent = view[0].toUpperCase()+view.slice(1); button.dataset.view = view;
    button.onclick = () => select(view); nav.append(button);
  }
  select(current); return { element:nav, select, get current() { return current; } };
}
