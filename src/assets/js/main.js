import { initHeroSlider } from "./hero.js";
import { initPanel } from "./panel.js";
import { initAskBar, initScrollTrack, initMobileNav } from "./nav.js";
import { initPwa } from "./pwa.js";
import { initOverlays } from "./overlays.js";
import { initFrictionTracking, track } from "./lib/telemetry.js";

function boot(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error("[cbc]", label, err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  boot("hero", initHeroSlider);
  boot("panel", initPanel);
  boot("ask", initAskBar);
  boot("scroll", initScrollTrack);
  boot("nav", initMobileNav);
  boot("pwa", initPwa);
  boot("overlays", initOverlays);
  boot("telemetry", () => {
    initFrictionTracking();
    track("session_started");
  });
  import("./auth-overlay.js").then((m) => m.initAuthOverlay()).catch((err) => console.error("[cbc] auth", err));
  import("./pay-overlay.js").then((m) => m.initPayOverlay()).catch((err) => console.error("[cbc] pay", err));
  import("./drm.js").then((m) => m.initDrmViewer()).catch((err) => console.error("[cbc] drm", err));
});
