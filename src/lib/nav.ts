/** Programmatic navigation usable outside React (service-worker messages, notifications). */
import { isAppPath } from './router';

export function navigateTo(path: string, replace = false): void {
  if (!isAppPath(path)) return;
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}
