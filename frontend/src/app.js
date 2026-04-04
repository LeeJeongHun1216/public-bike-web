import "./appState.js";
import { bootstrap } from "./bootstrap.js";
import { hideInitialLoadOverlay } from "./initialOverlay.js";

bootstrap().catch((e) => {
  hideInitialLoadOverlay();
  alert(String(e?.message || e));
});
