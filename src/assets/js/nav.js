import { $ } from "./lib/dom.js";
import { openPanel } from "./panel.js";
import {
  trackSearch,
  debounceSearch,
  newQueryId,
} from "./lib/telemetry.js";
import { SUBJECTS } from "./data/subjects.js";

function inferFileType(q) {
  const s = q.toLowerCase();
  if (/\bexam|paper|kpsea|kjsea\b/.test(s)) return "exams";
  if (/\bvideo|watch|lesson\b/.test(s)) return "videos";
  if (/\bgallery|photo|image\b/.test(s)) return "gallery";
  if (/\baudiobook|audio book|listen|podcast\b/.test(s)) return "audiobooks";
  if (/\bimmersive|virtual reality|\bvr\b|\bar\b|\b360\b/.test(s)) return "immersive";
  if (/\bexperiment|lab|3d|simulat/.test(s)) return "experiments";
  return "notes";
}

function inferGrade(q) {
  const m = q.match(/grade\s*(10|[4-9])/i);
  return m ? "Grade " + m[1] : null;
}

function inferSubject(q) {
  const s = q.toLowerCase();
  const hit = SUBJECTS.find((sub) => s.includes(sub.name.toLowerCase().split(" / ")[0]));
  return hit ? hit.name : null;
}

function countResults(q) {
  if (!q) return SUBJECTS.length;
  const n = q.toLowerCase();
  return SUBJECTS.filter((sub) =>
    (sub.name + " " + sub.topics.map((t) => t.name + " " + t.detail).join(" ")).toLowerCase().includes(n)
  ).length;
}

function runAsk(query) {
  const q = query.trim();
  const started = performance.now();
  const file_type = inferFileType(q);
  const grade_level = inferGrade(q);
  const subject_name = inferSubject(q);
  const result_count = countResults(q);
  const query_id = newQueryId();
  trackSearch({
    query: q,
    filters: { file_type, grade_level, subject_name },
    result_count,
    latency_ms: Math.round(performance.now() - started),
    query_id,
  });
  openPanel(file_type, q);
}

export function initAskBar() {
  const form = $("askForm");
  const input = $("askInput");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runAsk(input.value);
  });

  input.addEventListener("input", () => {
    const value = input.value.trim();
    if (!value) return;
    debounceSearch(() => {
      trackSearch({
        query: value,
        filters: {
          file_type: inferFileType(value),
          grade_level: inferGrade(value),
          subject_name: inferSubject(value),
        },
        result_count: countResults(value),
        latency_ms: 0,
        query_id: newQueryId(),
      });
    });
  });
}

export function initMobileNav() {
  const burger = $("burgerBtn");
  const links = document.querySelector(".nav__links");
  burger?.addEventListener("click", () => {
    const open = links?.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      burger?.setAttribute("aria-expanded", "false");
    });
  });
}

export function initScrollTrack() {
  const dot = $("trackDot");
  const hero = $("hero");
  if (!dot || !hero) return;
  window.addEventListener("scroll", () => {
    const heroHeight = hero.offsetHeight || 1;
    const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
    dot.style.left = `${progress * 113}px`;
  });
}
