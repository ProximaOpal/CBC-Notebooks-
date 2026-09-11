import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listPublicRoutes, parsePath } from "../src/assets/js/data/catalog.js";
import { renderHtml } from "../scripts/lib/prerender.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shell = readFileSync(join(root, "src", "index.html"), "utf8");

describe("public CBC routes", () => {
  it("maps grade, subject, resource and lab paths", () => {
    expect(parsePath("/grade-7/science/").type).toBe("gradeSubject");
    expect(parsePath("/grade-7/science/").subject.name).toBe("Integrated Science");
    expect(parsePath("/notes/grade-7/integrated-science/").resource).toBe("notes");
    expect(parsePath("/exams/grade-9/term-2/").type).toBe("examTerm");
    expect(parsePath("/labs/circuits/").lab.slug).toBe("current-electricity");
    expect(parsePath("/labs/3d/workshop-tools/").type).toBe("lab");
  });

  it("covers homepage, grades 4–10, notes/exams/videos and labs", () => {
    const routes = listPublicRoutes();
    const paths = new Set(routes.map((r) => r.path));
    expect(paths.has("/")).toBe(true);
    for (const n of [4, 5, 6, 7, 8, 9, 10]) {
      expect(paths.has(`/grade-${n}/`)).toBe(true);
    }
    expect(paths.has("/notes/grade-7/integrated-science/")).toBe(true);
    expect(paths.has("/exams/grade-7/integrated-science/")).toBe(true);
    expect(paths.has("/videos/grade-7/integrated-science/")).toBe(true);
    expect(paths.has("/labs/circuits/")).toBe(true);
    expect(routes.length).toBeGreaterThan(200);
  });
});

describe("prerendered HTML", () => {
  it("emits crawler-visible copy for Grade 7 science", () => {
    const { html, model } = renderHtml(shell, "/grade-7/science/");
    expect(model.h1).toBe("Grade 7 Integrated Science");
    expect(html).toContain("Grade 7 Integrated Science");
    expect(html).toContain("KPSEA");
    expect(html).toContain("KICD");
    expect(html).toContain("Exams");
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('href="/notes/grade-7/science/"');
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).not.toContain("is-seo-page");
    expect(html).toContain('id="seoDocument"');
    expect(html).toContain('class="hero"');
  });

  it("keeps Notes and other home resource controls as overlay buttons", () => {
    const home = renderHtml(shell, "/").html;
    const notes = renderHtml(shell, "/notes/").html;
    for (const html of [home, notes]) {
      expect(html).toContain('<button class="res-btn res-btn--solid" type="button" data-resource="notes">Notes</button>');
      expect(html).not.toMatch(/<aside class="hero__resources"[\s\S]*?<a class="res-btn/);
    }
  });
});
