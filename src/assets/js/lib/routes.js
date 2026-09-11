import { RESOURCE_HUBS, canonicalSlug, defaultGradeForSubject, parsePath, subjectHref } from "./data/catalog.js";
import { SUBJECTS } from "./data/subjects.js";

export function currentRoute() {
  return parsePath(typeof location !== "undefined" ? location.pathname : "/");
}

export function resourceForPath(pathname) {
  const route = parsePath(pathname);
  if (route.resource) return route.resource;
  if (route.type === "lab") return "experiments";
  return null;
}

export function subjectUrl(subject, resource = "notes") {
  const grade = defaultGradeForSubject(subject);
  return subjectHref(grade, subject, resource, canonicalSlug(subject));
}

export function subjectsByLevel() {
  return {
    up: SUBJECTS.filter((s) => s.level === "up"),
    jss: SUBJECTS.filter((s) => s.level === "jss"),
    ss: SUBJECTS.filter((s) => s.level === "ss"),
  };
}

export { RESOURCE_HUBS, parsePath };
