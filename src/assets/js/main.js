import { initHeroSlider } from "./hero.js";
import { initPanel } from "./panel.js";
import { initAskBar, initScrollTrack, initMobileNav } from "./nav.js";
import { initPwa } from "./pwa.js";
import { initOverlays } from "./overlays.js";
import { initAuthOverlay } from "./auth-overlay.js";
import { initFrictionTracking, track } from "./lib/telemetry.js";

document.addEventListener("DOMContentLoaded", () => {
  initHeroSlider();
  initPanel();
  initAskBar();
  initScrollTrack();
  initMobileNav();
  initPwa();
  initOverlays();
  initAuthOverlay();
  initFrictionTracking();
  track("session_started");
});
