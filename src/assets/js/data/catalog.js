/**
 * Public CBC route catalogue used by prerender (Node) and client hydration.
 */
import { SUBJECTS } from "./subjects.js";
import { LABS, findLab, labSlugs } from "./labs.js";

export { LABS, findLab, labSlugs };

export const SITE_ORIGIN = "https://cbcnotebooks.co.ke";
export const OG_IMAGE = `${SITE_ORIGIN}/assets/img/icons/icon-512.png`;

export const GRADES = [
  { n: 4, band: "up", exam: "KPSEA", stage: "Upper Primary", prep: "KPSEA preparation" },
  { n: 5, band: "up", exam: "KPSEA", stage: "Upper Primary", prep: "KPSEA preparation" },
  { n: 6, band: "up", exam: "KPSEA", stage: "Upper Primary", prep: "KPSEA (Grade 6 national assessment)" },
  { n: 7, band: "jss", exam: "KJSEA", stage: "Junior Secondary", prep: "KJSEA preparation" },
  { n: 8, band: "jss", exam: "KJSEA", stage: "Junior Secondary", prep: "KJSEA preparation" },
  { n: 9, band: "jss", exam: "KJSEA", stage: "Junior Secondary", prep: "KJSEA (Grade 9 national assessment)" },
  { n: 10, band: "ss", exam: "KSSEA", stage: "Senior School", prep: "KSSEA / Senior School pathway" },
];

export const EXAM_TERMS = [
  { slug: "term-1", name: "Term 1" },
  { slug: "term-2", name: "Term 2" },
  { slug: "term-3", name: "Term 3" },
];

export const RESOURCE_HUBS = [
  { id: "notes", path: "/notes/", label: "Notes", outline: false },
  { id: "videos", path: "/videos/", label: "Videos", outline: true },
  { id: "gallery", path: "/gallery/", label: "Photo Gallery", outline: false },
  { id: "experiments", path: "/labs/", label: "Experiments", outline: true },
  { id: "audiobooks", path: "/audiobooks/", label: "AudioBooks", outline: false },
  { id: "immersive", path: "/immersive/", label: "Immersive Learning", outline: true },
  { id: "exams", path: "/exams/", label: "Exams", outline: false },
];

const SLUG_OVERRIDE = {
  "up-eng": "english",
  "up-kis": "kiswahili",
  "up-sci": "science-and-technology",
  "up-agr": "agriculture-and-nutrition",
  "up-arts": "creative-arts",
  "up-ss": "social-studies",
  "up-phe": "physical-and-health-education",
  "up-re": "religious-education",
  "jss-eng": "english",
  "jss-kis": "kiswahili",
  "jss-sci": "integrated-science",
  "jss-tech": "pre-technical-studies",
  "jss-agr": "agriculture-and-nutrition",
  "jss-ss": "social-studies",
  "jss-bus": "business-studies",
  "jss-health": "health-education",
  "jss-arts": "creative-arts-and-sports",
  "jss-re": "religious-education",
  "jss-life": "life-skills",
  "ss-math": "core-mathematics",
  "ss-csl": "community-service-learning",
  "ss-pe": "physical-education",
  "ss-ict": "ict",
  "ss-re": "religious-education",
  "ss-applied": "applied-sciences",
  "ss-power": "power-mechanics",
  "ss-build": "building-and-construction",
  "ss-elec": "electrical-technology",
  "ss-cs": "computer-studies",
  "ss-hist": "history-and-citizenship",
  "ss-lit": "literature-in-english",
  "ss-fasihi": "fasihi-ya-kiswahili",
  "ss-art": "fine-arts",
  "ss-music": "music-and-dance",
  "ss-theatre": "theatre-and-film",
  "ss-sport": "sports-science",
};

const SLUG_ALIASES = {
  "up-eng": ["english-language"],
  "up-sci": ["science"],
  "up-re": ["cre", "ire", "hre"],
  "jss-sci": ["science"],
  "jss-tech": ["pre-technical", "pre-technical-and-pre-career-education"],
  "jss-re": ["cre", "ire", "hre"],
  "jss-life": ["life-skills-education"],
  "ss-re": ["cre", "ire", "hre"],
};

const TRACK_TITLE = {
  cre: "Christian Religious Education",
  ire: "Islamic Religious Education",
  hre: "Hindu Religious Education",
};

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalSlug(subject) {
  return SLUG_OVERRIDE[subject.id] || slugify(subject.name);
}

export function subjectSlugs(subject) {
  const primary = canonicalSlug(subject);
  const aliases = SLUG_ALIASES[subject.id] || [];
  return [primary, ...aliases.filter((s) => s !== primary)];
}

export function gradeMeta(n) {
  return GRADES.find((g) => g.n === Number(n)) || null;
}

export function subjectsForGrade(n) {
  const grade = gradeMeta(n);
  if (!grade) return [];
  return SUBJECTS.filter((s) => s.level === grade.band);
}

export function findSubject(grade, slug) {
  const key = String(slug || "").toLowerCase();
  return subjectsForGrade(grade).find((s) => subjectSlugs(s).includes(key)) || null;
}

export function displaySubjectName(subject, slug) {
  return TRACK_TITLE[slug] || subject.name;
}

export function defaultGradeForSubject(subject) {
  if (subject.level === "up") return 6;
  if (subject.level === "ss") return 10;
  return 7;
}

export function trail(path) {
  const clean = "/" + String(path || "").replace(/^\/+|\/+$/g, "");
  return clean === "/" ? "/" : `${clean}/`;
}

export function parsePath(pathname) {
  const parts = String(pathname || "/")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p).toLowerCase());

  if (parts.length === 0) return { type: "home", path: "/" };

  if (parts[0] === "grade" && parts[1] && /^\d+$/.test(parts[1])) {
    parts.splice(0, 1, `grade-${parts[1]}`);
  }

  const hubs = new Set(["notes", "exams", "videos", "gallery", "audiobooks", "immersive", "labs"]);

  if (parts[0] === "labs") {
    const slug = parts[1] === "3d" ? parts[2] : parts[1];
    const lab = slug ? findLab(slug) : null;
    if (lab) {
      return { type: "lab", path: trail(parts.join("/")), lab, slug: lab.slug };
    }
    return { type: "hub", path: "/labs/", resource: "experiments" };
  }

  if (hubs.has(parts[0]) && parts.length === 1) {
    const resource = parts[0] === "labs" ? "experiments" : parts[0];
    return { type: "hub", path: trail(parts[0]), resource };
  }

  if (hubs.has(parts[0]) && /^grade-\d+$/.test(parts[1] || "")) {
    const grade = Number(parts[1].slice(6));
    const gm = gradeMeta(grade);
    if (!gm) return { type: "unknown", path: trail(parts.join("/")) };
    if (!parts[2]) {
      if (parts[0] === "exams") {
        return { type: "examGrade", path: trail(parts.join("/")), grade: gm, resource: "exams" };
      }
      return { type: "resourceGrade", path: trail(parts.join("/")), grade: gm, resource: parts[0] };
    }
    const term = EXAM_TERMS.find((t) => t.slug === parts[2]);
    if (parts[0] === "exams" && term) {
      return { type: "examTerm", path: trail(parts.join("/")), grade: gm, term, resource: "exams" };
    }
    const subject = findSubject(grade, parts[2]);
    if (!subject) return { type: "unknown", path: trail(parts.join("/")) };
    return {
      type: "resourceSubject",
      path: trail(parts.join("/")),
      grade: gm,
      subject,
      slug: parts[2],
      resource: parts[0],
      topic: parts[3] || null,
    };
  }

  if (/^grade-\d+$/.test(parts[0])) {
    const grade = Number(parts[0].slice(6));
    const gm = gradeMeta(grade);
    if (!gm) return { type: "unknown", path: trail(parts.join("/")) };
    if (!parts[1]) return { type: "grade", path: trail(parts[0]), grade: gm };
    const subject = findSubject(grade, parts[1]);
    if (!subject) return { type: "unknown", path: trail(parts.join("/")) };
    return {
      type: "gradeSubject",
      path: trail(parts.join("/")),
      grade: gm,
      subject,
      slug: parts[1],
      resource: "notes",
    };
  }

  return { type: "unknown", path: trail(parts.join("/")) };
}

function pushUnique(list, route) {
  if (!route || !route.path) return;
  if (list.some((r) => r.path === route.path)) return;
  list.push(route);
}

export function listPublicRoutes() {
  const routes = [{ type: "home", path: "/" }];

  for (const hub of RESOURCE_HUBS) {
    pushUnique(routes, parsePath(hub.path));
  }

  for (const grade of GRADES) {
    pushUnique(routes, parsePath(`/grade-${grade.n}/`));
    pushUnique(routes, parsePath(`/notes/grade-${grade.n}/`));
    pushUnique(routes, parsePath(`/videos/grade-${grade.n}/`));
    pushUnique(routes, parsePath(`/exams/grade-${grade.n}/`));
    for (const term of EXAM_TERMS) {
      pushUnique(routes, parsePath(`/exams/grade-${grade.n}/${term.slug}/`));
    }
    for (const subject of subjectsForGrade(grade.n)) {
      for (const slug of subjectSlugs(subject)) {
        pushUnique(routes, parsePath(`/grade-${grade.n}/${slug}/`));
        pushUnique(routes, parsePath(`/notes/grade-${grade.n}/${slug}/`));
        pushUnique(routes, parsePath(`/exams/grade-${grade.n}/${slug}/`));
        pushUnique(routes, parsePath(`/videos/grade-${grade.n}/${slug}/`));
      }
    }
  }

  for (const lab of LABS) {
    for (const slug of labSlugs(lab)) {
      pushUnique(routes, parsePath(`/labs/${slug}/`));
      pushUnique(routes, parsePath(`/labs/3d/${slug}/`));
    }
  }

  return routes.filter((r) => r.type !== "unknown");
}

function assessmentLine(grade) {
  if (grade.n <= 6) {
    return `This page supports ${grade.stage} learners sitting KPSEA-aligned school assessments and the Grade 6 KPSEA national assessment.`;
  }
  if (grade.n <= 9) {
    return `This page supports ${grade.stage} learners on the KJSEA pathway, building on KPSEA from Grade 6.`;
  }
  return `This page supports Senior School Grade 10 learners on the KSSEA pathway after KJSEA.`;
}

function resourceLabel(resource) {
  const hit = RESOURCE_HUBS.find((h) => h.id === resource);
  if (hit) return hit.label;
  if (resource === "experiments") return "Experiments";
  return "Notes";
}

export function pageModel(route) {
  const parsed = typeof route === "string" ? parsePath(route) : route;
  const type = parsed.type || "home";

  if (type === "home") {
    return {
      ...parsed,
      type: "home",
      title: "CBC Notebooks — Learning, Kenya",
      description:
        "CBC Notebooks publishes KICD-aligned notes, videos, exams, galleries and virtual labs for Kenya Grades 4–10 — from KPSEA through KJSEA and KSSEA.",
      h1: "CBC Notebooks",
      h2: "Kenya CBC notes, exams and labs for Grades 4–10",
    };
  }

  if (type === "hub") {
    const label = resourceLabel(parsed.resource);
    return {
      ...parsed,
      title: `${label} · CBC Notebooks — Kenya Grades 4–10`,
      description: `Browse ${label.toLowerCase()} for Kenya CBC Grades 4–10. KICD strands, KPSEA, KJSEA and KSSEA resources with download links.`,
      h1: `${label} for Kenya CBC`,
      h2: "KICD strands from Grade 4 through Grade 10",
    };
  }

  if (type === "grade" || type === "resourceGrade" || type === "examGrade") {
    const g = parsed.grade;
    const label = type === "grade" ? `Grade ${g.n}` : `${resourceLabel(parsed.resource)} · Grade ${g.n}`;
    return {
      ...parsed,
      title: `${label} CBC ${g.exam} resources | CBC Notebooks`,
      description: `${g.stage} Grade ${g.n} ${resourceLabel(parsed.resource || "notes").toLowerCase()} aligned to KICD CBC. ${assessmentLine(g)}`,
      h1: `${label} CBC`,
      h2: `${g.stage} · ${g.exam} · KICD curriculum`,
    };
  }

  if (type === "examTerm") {
    const g = parsed.grade;
    return {
      ...parsed,
      title: `Grade ${g.n} ${parsed.term.name} exams and marking schemes | CBC Notebooks`,
      description: `${g.exam}-style revision papers, answers and schemes of work for Grade ${g.n} ${parsed.term.name}. KICD CBC exams for ${g.stage}.`,
      h1: `Grade ${g.n} ${parsed.term.name} Exams`,
      h2: `${g.exam} papers, marking schemes and KICD schemes of work`,
    };
  }

  if (type === "gradeSubject" || type === "resourceSubject") {
    const g = parsed.grade;
    const name = displaySubjectName(parsed.subject, parsed.slug);
    const kind = resourceLabel(parsed.resource || "notes");
    const topic = parsed.topic ? ` · ${parsed.topic.replace(/-/g, " ")}` : "";
    return {
      ...parsed,
      title: `Grade ${g.n} ${name} CBC ${kind}${topic} | CBC Notebooks`,
      description: `Grade ${g.n} ${name} ${kind.toLowerCase()} aligned to KICD CBC strands. ${assessmentLine(g)} Download notes, exams and related labs.`,
      h1: `Grade ${g.n} ${name}`,
      h2: `${kind} · ${g.stage} · KICD ${name} strands`,
    };
  }

  if (type === "lab") {
    const lab = parsed.lab;
    return {
      ...parsed,
      title: `${lab.name} · CBC virtual lab | CBC Notebooks`,
      description: `${lab.detail} KICD-aligned experiment for ${lab.subject}. Grades ${lab.grades.join(", ")}.`,
      h1: lab.name,
      h2: `${lab.subject} virtual laboratory · KICD CBC`,
    };
  }

  return {
    ...parsed,
    title: "CBC Notebooks — Learning, Kenya",
    description: "CBC learning resources for Kenya Grades 4–10.",
    h1: "CBC Notebooks",
    h2: "Kenya CBC curriculum",
  };
}

export function subjectHref(grade, subject, resource = "notes", slug) {
  const s = slug || canonicalSlug(subject);
  const hub = resource === "experiments" ? "labs" : resource;
  if (hub === "notes" || hub === "exams" || hub === "videos") {
    return `/${hub}/grade-${grade}/${s}/`;
  }
  return `/grade-${grade}/${s}/`;
}

export function jsonLdFor(model) {
  const url = `${SITE_ORIGIN}${model.path === "/" ? "/" : model.path}`;
  const org = {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#org`,
    name: "CBC Notebooks",
    url: SITE_ORIGIN,
    logo: OG_IMAGE,
    areaServed: "KE",
  };

  if (model.type === "lab") {
    return [
      org,
      {
        "@type": "LearningResource",
        name: model.lab.name,
        description: model.description,
        url,
        learningResourceType: "virtual laboratory",
        educationalLevel: model.lab.grades.map((n) => `Grade ${n}`),
        isAccessibleForFree: true,
        about: { "@type": "Thing", name: model.lab.subject },
        provider: { "@type": "Organization", name: "CBC Notebooks", url: SITE_ORIGIN },
      },
    ];
  }

  if (model.subject && model.grade) {
    const resourceType =
      model.resource === "exams" ? "exam paper" : model.resource === "videos" ? "video lesson" : "notes";
    return [
      org,
      {
        "@type": "Course",
        name: model.h1,
        description: model.description,
        url,
        educationalLevel: `Grade ${model.grade.n}`,
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: "CBC Notebooks", url: SITE_ORIGIN },
        about: { "@type": "Thing", name: displaySubjectName(model.subject, model.slug) },
        educationalCredentialAwarded: model.grade.prep,
      },
      {
        "@type": "LearningResource",
        name: `${model.h1} ${resourceLabel(model.resource || "notes")}`,
        description: model.description,
        url,
        learningResourceType: resourceType,
        encodingFormat: model.resource === "videos" ? "video/mp4" : "application/pdf",
        educationalLevel: `Grade ${model.grade.n}`,
        inLanguage: ["en", "sw"],
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: "CBC Notebooks", url: SITE_ORIGIN },
      },
    ];
  }

  if (model.grade) {
    return [
      org,
      {
        "@type": "Course",
        name: `Grade ${model.grade.n} CBC subject pathway`,
        description: model.description,
        url,
        educationalLevel: `Grade ${model.grade.n}`,
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: "CBC Notebooks", url: SITE_ORIGIN },
        educationalCredentialAwarded: model.grade.prep,
      },
    ];
  }

  return [
    org,
    ...GRADES.map((grade) => ({
      "@type": "Course",
      name: `Grade ${grade.n} CBC subject pathway`,
      description: `Kenya Competency-Based Curriculum pathway for Grade ${grade.n}, covering notes, exams, videos and labs.`,
      url: `${SITE_ORIGIN}/grade-${grade.n}/`,
      educationalLevel: `Grade ${grade.n}`,
      isAccessibleForFree: true,
      provider: { "@type": "Organization", name: "CBC Notebooks", url: SITE_ORIGIN },
      educationalCredentialAwarded: grade.prep,
    })),
  ];
}
