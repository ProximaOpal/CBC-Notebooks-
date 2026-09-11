import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  EXAM_TERMS,
  GRADES,
  LABS,
  OG_IMAGE,
  RESOURCE_HUBS,
  SITE_ORIGIN,
  canonicalSlug,
  displaySubjectName,
  jsonLdFor,
  labSlugs,
  listPublicRoutes,
  pageModel,
  subjectSlugs,
  subjectsForGrade,
} from "../../src/assets/js/data/catalog.js";
import { findLab } from "../../src/assets/js/data/labs.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rewriteRootAssets(html, prefix) {
  if (!prefix) {
    return html
      .replace(/(href|src)="assets\//g, '$1="/assets/')
      .replace(/url\('assets\//g, "url('/assets/")
      .replace(/href="manifest\.webmanifest"/g, 'href="/manifest.webmanifest"');
  }
  return html
    .replace(/(href|src)="\/assets\//g, `$1="${prefix}assets/`)
    .replace(/(href|src)="assets\//g, `$1="${prefix}assets/`)
    .replace(/url\('\/assets\//g, `url('${prefix}assets/`)
    .replace(/url\('assets\//g, `url('${prefix}assets/`)
    .replace(/href="\/manifest\.webmanifest"/g, `href="${prefix}manifest.webmanifest"`)
    .replace(/href="manifest\.webmanifest"/g, `href="${prefix}manifest.webmanifest"`);
}

function gradeLinks() {
  return GRADES.map(
    (g) => `<li><a href="/grade-${g.n}/">Grade ${g.n}</a> <span>${esc(g.stage)} · ${esc(g.exam)}</span></li>`
  ).join("");
}

function hubLinks() {
  return RESOURCE_HUBS.map((h) => `<li><a href="${h.path}">${esc(h.label)}</a></li>`).join("");
}

function subjectList(grade, resource = "notes") {
  const hub = resource === "experiments" ? "notes" : resource;
  return subjectsForGrade(grade.n)
    .map((subject) => {
      const slug = canonicalSlug(subject);
      const href =
        hub === "notes" || hub === "exams" || hub === "videos"
          ? `/${hub}/grade-${grade.n}/${slug}/`
          : `/grade-${grade.n}/${slug}/`;
      const topics = subject.topics
        .map((t) => `<li><strong>${esc(t.name)}</strong> — ${esc(t.detail)}</li>`)
        .join("");
      return `<article class="seo__subject">
        <h2><a href="${href}">${esc(subject.name)}</a></h2>
        <p>${esc(subject.topics.length)} KICD strands for Grade ${grade.n} ${esc(subject.name)}.</p>
        <ul class="seo__strands">${topics}</ul>
        <p class="seo__downloads">
          <a href="/notes/grade-${grade.n}/${slug}/">Download notes</a>
          <a href="/exams/grade-${grade.n}/${slug}/">Download exams</a>
          <a href="/videos/grade-${grade.n}/${slug}/">Watch videos</a>
        </p>
      </article>`;
    })
    .join("");
}

function relatedLabs(query) {
  const q = String(query || "").toLowerCase();
  return LABS.filter((lab) => `${lab.name} ${lab.subject} ${lab.detail}`.toLowerCase().includes(q)).slice(0, 6);
}

function labLinks(labs) {
  return labs
    .map((lab) => `<li><a href="/labs/${lab.slug}/">${esc(lab.name)}</a> — ${esc(lab.detail)}</li>`)
    .join("");
}

function documentHtml(model) {
  if (model.type === "home") {
    const gradeCards = GRADES.map((g) => {
      const subjects = subjectsForGrade(g.n)
        .slice(0, 8)
        .map((s) => `<li><a href="/notes/grade-${g.n}/${canonicalSlug(s)}/">${esc(s.name)}</a></li>`)
        .join("");
      return `<section class="seo__grade">
        <h2><a href="/grade-${g.n}/">Grade ${g.n} ${esc(g.stage)}</a></h2>
        <p>KICD CBC ${esc(g.exam)} pathway. Notes, exams, videos and labs for Grade ${g.n}.</p>
        <ul>${subjects}</ul>
        <p class="seo__downloads">
          <a href="/notes/grade-${g.n}/">Grade ${g.n} notes</a>
          <a href="/exams/grade-${g.n}/">Grade ${g.n} exams</a>
          <a href="/videos/grade-${g.n}/">Grade ${g.n} videos</a>
        </p>
      </section>`;
    }).join("");
    return `<nav class="seo__crumbs" aria-label="Breadcrumb"><a href="/">Home</a></nav>
      <h2>Kenya CBC notes, exams and labs for Grades 4–10</h2>
      <p>CBC Notebooks is a KICD-aligned library for Kenya Grades 4–10. Learners, parents and teachers can open notes, KPSEA and KJSEA exams, marking schemes, video lessons and virtual laboratories without waiting for JavaScript.</p>
      <p>Upper Primary (Grades 4–6) prepares learners for <strong>KPSEA</strong>. Junior Secondary (Grades 7–9) prepares learners for <strong>KJSEA</strong>, including Grade 7 Integrated Science. Senior School Grade 10 follows the <strong>KSSEA</strong> pathway.</p>
      <h2>Browse by grade</h2>
      <ul class="seo__grades">${gradeLinks()}</ul>
      <h2>Resource libraries</h2>
      <ul>${hubLinks()}</ul>
      ${gradeCards}
      <section>
        <h2>Featured laboratories</h2>
        <ul>${labLinks(LABS.slice(0, 12))}</ul>
        <p><a href="/labs/">All CBC virtual labs</a></p>
      </section>`;
  }

  if (model.type === "hub") {
    const byGrade = GRADES.map((g) => {
      const resource = model.resource === "experiments" ? "notes" : model.resource;
      const items = subjectsForGrade(g.n)
        .map((s) => {
          const slug = canonicalSlug(s);
          const href =
            resource === "notes" || resource === "exams" || resource === "videos"
              ? `/${resource}/grade-${g.n}/${slug}/`
              : `/grade-${g.n}/${slug}/`;
          return `<li><a href="${href}">Grade ${g.n} ${esc(s.name)}</a></li>`;
        })
        .join("");
      return `<section class="seo__grade"><h2><a href="/grade-${g.n}/">Grade ${g.n}</a></h2><ul>${items}</ul></section>`;
    }).join("");
    const extra =
      model.resource === "experiments"
        ? `<section><h2>Virtual labs</h2><ul>${labLinks(LABS)}</ul></section>`
        : "";
    return `<nav class="seo__crumbs"><a href="/">Home</a> / ${esc(model.h1)}</nav>
      <h1>${esc(model.h1)}</h1>
      <h2>${esc(model.h2)}</h2>
      <p>${esc(model.description)} Every link below is a static HTML page with KICD strand topics and download links.</p>
      ${byGrade}${extra}`;
  }

  if (model.type === "grade" || model.type === "resourceGrade" || model.type === "examGrade") {
    const g = model.grade;
    const terms =
      model.resource === "exams"
        ? `<p class="seo__downloads">${EXAM_TERMS.map(
            (t) => `<a href="/exams/grade-${g.n}/${t.slug}/">${esc(t.name)} exams</a>`
          ).join(" ")}</p>`
        : "";
    return `<nav class="seo__crumbs"><a href="/">Home</a> / <a href="/grade-${g.n}/">Grade ${g.n}</a></nav>
      <h1>${esc(model.h1)}</h1>
      <h2>${esc(model.h2)}</h2>
      <p>${esc(model.description)}</p>
      <p>Download KICD-aligned notes, KPSEA/KJSEA/KSSEA-style exams and watch CBC video lessons for every subject in Grade ${g.n}.</p>
      <p class="seo__downloads">
        <a href="/notes/grade-${g.n}/">Notes</a>
        <a href="/exams/grade-${g.n}/">Exams</a>
        <a href="/videos/grade-${g.n}/">Videos</a>
        <a href="/labs/">Labs</a>
      </p>
      ${terms}
      ${subjectList(g, model.resource || "notes")}`;
  }

  if (model.type === "examTerm") {
    const g = model.grade;
    const subjects = subjectsForGrade(g.n)
      .map((s) => {
        const slug = canonicalSlug(s);
        return `<li>
          <a href="/exams/grade-${g.n}/${slug}/">${esc(s.name)} exam paper</a>
          — ${g.exam} ${esc(model.term.name)} pack with marking scheme and scheme of work.
          <a href="/notes/grade-${g.n}/${slug}/">Matching notes</a>
        </li>`;
      })
      .join("");
    return `<nav class="seo__crumbs"><a href="/">Home</a> / <a href="/exams/">Exams</a> / <a href="/exams/grade-${g.n}/">Grade ${g.n}</a></nav>
      <h1>${esc(model.h1)}</h1>
      <h2>${esc(model.h2)}</h2>
      <p>${esc(model.description)}</p>
      <p>Each subject pack includes opener, midterm and end-term papers plus answers. KICD strand coverage is listed on the subject exam page.</p>
      <ul>${subjects}</ul>
      <p class="seo__downloads">
        <a href="/exams/grade-${g.n}/term-1/">Term 1</a>
        <a href="/exams/grade-${g.n}/term-2/">Term 2</a>
        <a href="/exams/grade-${g.n}/term-3/">Term 3</a>
      </p>`;
  }

  if (model.type === "gradeSubject" || model.type === "resourceSubject") {
    const g = model.grade;
    const subject = model.subject;
    const name = displaySubjectName(subject, model.slug);
    const slug = model.slug || canonicalSlug(subject);
    const strands = subject.topics
      .map((t) => `<section class="seo__strand">
        <h2>${esc(t.name)}</h2>
        <p>${esc(t.detail)}</p>
        <p class="seo__downloads">
          <a href="/notes/grade-${g.n}/${slug}/#${esc(t.id)}">Download ${esc(t.name)} notes (PDF)</a>
          <a href="/exams/grade-${g.n}/${slug}/">Related exams</a>
        </p>
      </section>`)
      .join("");
    const labs = relatedLabs(name);
    const aliases = subjectSlugs(subject)
      .filter((s) => s !== slug)
      .map((s) => `<a href="/notes/grade-${g.n}/${s}/">${esc(s.replace(/-/g, " "))}</a>`)
      .join(" · ");
    return `<nav class="seo__crumbs">
        <a href="/">Home</a> /
        <a href="/grade-${g.n}/">Grade ${g.n}</a> /
        <span>${esc(name)}</span>
      </nav>
      <h1>${esc(model.h1)}</h1>
      <h2>${esc(model.h2)}</h2>
      <p>${esc(model.description)}</p>
      <p>Grade ${g.n} ${esc(name)} follows the KICD Competency-Based Curriculum. Use the download links for printable notes and ${g.exam} practice papers, or open the matching video lessons. Exams, marking schemes and schemes of work sit beside the strand list.</p>
      <p class="seo__downloads">
        <a href="/notes/grade-${g.n}/${slug}/">Download notes</a>
        <a href="/exams/grade-${g.n}/${slug}/">Download Exams</a>
        <a href="/videos/grade-${g.n}/${slug}/">Watch videos</a>
        <a href="/labs/">Open labs</a>
      </p>
      ${strands}
      ${labs.length ? `<section><h2>Related virtual labs</h2><ul>${labLinks(labs)}</ul></section>` : ""}
      ${aliases ? `<p>Also listed as ${aliases}.</p>` : ""}
      <p><a href="/grade-${g.n}/">All Grade ${g.n} subjects</a></p>`;
  }

  if (model.type === "lab") {
    const lab = model.lab;
    const gradeLinksLocal = lab.grades
      .map((n) => `<a href="/grade-${n}/">Grade ${n}</a>`)
      .join(" · ");
    return `<nav class="seo__crumbs"><a href="/">Home</a> / <a href="/labs/">Labs</a> / ${esc(lab.name)}</nav>
      <h1>${esc(lab.name)}</h1>
      <h2>${esc(model.h2)}</h2>
      <p>${esc(lab.detail)}</p>
      <p>This KICD-aligned virtual experiment supports ${esc(lab.subject)} for ${gradeLinksLocal}. Learners can explore the lab online, then download matching notes and exams.</p>
      <p class="seo__downloads">
        <a href="/labs/${lab.slug}/">Open lab</a>
        <a href="/labs/3d/${lab.slug}/">3D lab view</a>
        <a href="/notes/">Subject notes</a>
        <a href="/exams/">Exams</a>
      </p>
      <p>Related experiments:</p>
      <ul>${labLinks(LABS.filter((item) => item.subject === lab.subject && item.slug !== lab.slug).slice(0, 8))}</ul>`;
  }

  return `<h1>${esc(model.h1)}</h1><p>${esc(model.description)}</p>`;
}

function headTags(model) {
  const url = `${SITE_ORIGIN}${model.path === "/" ? "/" : model.path}`;
  const title = esc(model.title);
  const description = esc(model.description);
  const image = OG_IMAGE;
  const graph = {
    "@context": "https://schema.org",
    "@graph": jsonLdFor(model),
  };
  const ld = JSON.stringify(graph).replace(/</g, "\\u003c");
  return `
<title>${title}</title>
<link rel="canonical" href="${url}" />
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="CBC Notebooks" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json">${ld}</script>
`;
}

function replaceHead(html, model) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/, "");
  next = next.replace(/<link rel="canonical"[^>]*>/, "");
  next = next.replace(/<meta name="description"[^>]*>/, "");
  next = next.replace(/<meta property="og:[^"]+"[^>]*>/g, "");
  next = next.replace(/<meta name="twitter:[^"]+"[^>]*>/g, "");
  next = next.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  next = next.replace(/\n{3,}/g, "\n\n");
  next = next.replace("</head>", `${headTags(model)}</head>`);
  return next;
}

function setResourceLinks(html) {
  const buttons = RESOURCE_HUBS.map((h) => {
    const cls = h.outline ? "res-btn res-btn--outline" : "res-btn res-btn--solid";
    return `<a class="${cls}" href="${h.path}" data-resource="${h.id}">${esc(h.label)}</a>`;
  }).join("\n      ");
  return html.replace(
    /<aside class="hero__resources"[\s\S]*?<\/aside>/,
    `<aside class="hero__resources" id="resourceBtns" aria-label="Resources">\n      ${buttons}\n    </aside>`
  );
}

function injectDocument(html, model) {
  const block = `<main id="seoDocument" class="seo" aria-hidden="true">${documentHtml(model)}</main>`;
  if (html.includes('id="seoDocument"')) {
    return html.replace(/<main id="seoDocument"[\s\S]*?<\/main>/, block);
  }
  return html.replace('<div class="panel"', `${block}\n\n<div class="panel"`);
}

function setBody(html, model) {
  return html
    .replace(/<html lang="en(?:-KE)?">/, `<html lang="en-KE">`)
    .replace(/<body[^>]*>/, `<body data-route="${esc(model.path)}" data-route-type="${esc(model.type)}">`)
    .replace(/href="#hero"/g, 'href="/"')
    .replace(/src="assets\/js\/main\.js"/, 'src="/assets/js/main.js"');
}

export function renderHtml(shell, route) {
  const model = pageModel(route);
  let html = replaceHead(shell, model);
  html = setResourceLinks(html);
  html = injectDocument(html, model);
  html = setBody(html, model);
  html = rewriteRootAssets(html, "");
  html = html.replace(/navigator\.serviceWorker\.register\("\.\/sw\.js"\)/g, 'navigator.serviceWorker.register("/sw.js")');
  return { html, model };
}

export function writeRenderedPage(distRoot, path, html) {
  const file =
    path === "/"
      ? join(distRoot, "index.html")
      : join(distRoot, path.replace(/^\//, "").replace(/\/$/, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return file;
}

function urlEntry(path) {
  return `  <url><loc>${SITE_ORIGIN}${path === "/" ? "/" : path}</loc><changefreq>weekly</changefreq></url>`;
}

export function buildSitemaps(routes) {
  const groups = {
    "sitemap.xml": routes.filter((r) => r.type === "home" || r.type === "grade" || r.type === "hub" || r.type === "gradeSubject"),
    "sitemap-notes.xml": routes.filter((r) => r.path.startsWith("/notes/")),
    "sitemap-exams.xml": routes.filter((r) => r.path.startsWith("/exams/")),
    "sitemap-videos.xml": routes.filter((r) => r.path.startsWith("/videos/")),
    "sitemap-labs.xml": routes.filter((r) => r.path.startsWith("/labs/")),
    "sitemap-gallery.xml": routes.filter((r) => r.path.startsWith("/gallery/") || r.path.startsWith("/audiobooks/") || r.path.startsWith("/immersive/")),
    "sitemap-grade-10.xml": routes.filter((r) => r.path.includes("grade-10")),
    "sitemap-kssea.xml": routes.filter((r) => r.grade?.n === 10 || r.path.includes("grade-10")),
  };

  const files = {};
  const indexItems = [];
  for (const [name, list] of Object.entries(groups)) {
    if (name === "sitemap.xml") continue;
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((r) => urlEntry(r.path)).join("\n")}\n</urlset>\n`;
    files[name] = body;
    indexItems.push(`  <sitemap><loc>${SITE_ORIGIN}/${name}</loc></sitemap>`);
  }
  const core = groups["sitemap.xml"].map((r) => urlEntry(r.path)).join("\n");
  files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexItems.join("\n")}\n</sitemapindex>\n`;
  files["sitemap-core.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${core}\n</urlset>\n`;
  return files;
}

export function prerenderAll(shell, distRoot) {
  const routes = listPublicRoutes();
  const written = [];
  for (const route of routes) {
    const { html, model } = renderHtml(shell, route);
    written.push({ file: writeRenderedPage(distRoot, model.path, html), path: model.path, type: model.type });
  }
  const maps = buildSitemaps(routes);
  for (const [name, body] of Object.entries(maps)) {
    writeFileSync(join(distRoot, name), body);
  }
  return { routes, written, sitemaps: Object.keys(maps) };
}

export { listPublicRoutes, pageModel, findLab };
