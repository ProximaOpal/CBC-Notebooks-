import { AUTOPLAY_MS } from "./config.js";
import { $ } from "./lib/dom.js";
import { SLIDE_PHOTOS } from "./data/subjects.js";

let slideIndex = 0;
let slideBusy = false;
let slideTimer;

function setSlideImage(el, url) {
  el.style.backgroundImage = `url('${url}')`;
}

function updateDots() {
  document.querySelectorAll("#heroDots .dot").forEach((dot, i) => {
    dot.classList.toggle("is-active", i === slideIndex);
  });
}

export function goToSlide(next) {
  const photos = SLIDE_PHOTOS;
  if (photos.length === 0) return;
  const target = ((next % photos.length) + photos.length) % photos.length;
  if (target === slideIndex || slideBusy) return;

  const strip = $("heroStrip");
  const slideA = $("slideA");
  const slideB = $("slideB");
  if (!strip || !slideA || !slideB) return;

  slideBusy = true;
  setSlideImage(slideB, photos[target]);
  strip.classList.add("is-moving");

  const finish = (e) => {
    if (e.propertyName !== "transform") return;
    if (!slideBusy) return;
    strip.removeEventListener("transitionend", finish);
    setSlideImage(slideA, photos[target]);
    strip.classList.remove("is-moving");
    void strip.offsetWidth;
    slideIndex = target;
    slideBusy = false;
    updateDots();
  };
  strip.addEventListener("transitionend", finish);
  window.setTimeout(() => {
    if (slideBusy) finish({ propertyName: "transform" });
  }, 1000);
}

export function slideToPhoto(url) {
  if (!url) return;
  const idx = SLIDE_PHOTOS.indexOf(url);
  if (idx >= 0) {
    goToSlide(idx);
    return;
  }
  const slideA = $("slideA");
  if (slideA) setSlideImage(slideA, url);
}

export function pauseAutoplay() {
  if (slideTimer) window.clearInterval(slideTimer);
}

export function restartAutoplay() {
  pauseAutoplay();
  slideTimer = window.setInterval(() => goToSlide(slideIndex + 1), AUTOPLAY_MS);
}

export function initHeroSlider() {
  const dotsWrap = $("heroDots");
  const slideA = $("slideA");
  if (!dotsWrap || !slideA) return;

  setSlideImage(slideA, SLIDE_PHOTOS[0]);
  dotsWrap.innerHTML = SLIDE_PHOTOS.map((_, i) =>
    `<button class="dot${i === 0 ? " is-active" : ""}" data-slide="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join("");

  dotsWrap.querySelectorAll(".dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      goToSlide(Number(dot.dataset.slide));
      restartAutoplay();
    });
  });

  restartAutoplay();
}
