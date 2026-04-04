import { els } from "./elements.js";

export function hideInitialLoadOverlay() {
  const el = els.initialLoadOverlay;
  if (!el) return;
  el.hidden = true;
  el.setAttribute("aria-busy", "false");
}
