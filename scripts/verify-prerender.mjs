import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const KEYWORDS = ["Grade 7 Integrated Science", "KPSEA", "KICD", "Exams"];

const REQUIRED_FILES = [
  "index.html",
  "grade-4/index.html",
  "grade-5/index.html",
  "grade-6/index.html",
  "grade-7/index.html",
  "grade-8/index.html",
  "grade-9/index.html",
  "grade-10/index.html",
  "grade-7/science/index.html",
  "notes/grade-7/integrated-science/index.html",
  "exams/grade-7/integrated-science/index.html",
  "videos/grade-7/integrated-science/index.html",
  "labs/circuits/index.html",
  "labs/3d/current-electricity/index.html",
  "sitemap.xml",
];

function fail(message) {
  console.error("prerender verify failed:", message);
  process.exit(1);
}

function countHtml(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) n += countHtml(abs);
    else if (name === "index.html") n += 1;
  }
  return n;
}

if (!existsSync(dist)) fail("dist/ is missing — run npm run build first");

for (const rel of REQUIRED_FILES) {
  const abs = join(dist, rel);
  if (!existsSync(abs)) fail(`missing ${rel}`);
}

const science = readFileSync(join(dist, "grade-7", "science", "index.html"), "utf8");
if (/<div id="root"><\/div>/.test(science)) fail("empty #root shell found in grade-7 science HTML");
for (const word of KEYWORDS) {
  if (!science.includes(word)) fail(`"${word}" missing from grade-7/science/index.html`);
}

if (!/<h1[^>]*>Grade 7 Integrated Science/.test(science)) {
  fail("grade-7 science page is missing the Grade 7 Integrated Science h1");
}
if (!/meta name="description"/.test(science)) fail("missing meta description");
if (!/property="og:title"/.test(science)) fail("missing og:title");
if (!/property="og:description"/.test(science)) fail("missing og:description");
if (!/property="og:image"/.test(science)) fail("missing og:image");
if (!/name="twitter:card"/.test(science)) fail("missing twitter card");
if (!/href="\/notes\/grade-7\/integrated-science\/"/.test(science)) fail("missing crawlable notes link");

const home = readFileSync(join(dist, "index.html"), "utf8");
for (const href of ["/grade-4/", "/grade-10/", "/notes/", "/exams/", "/videos/", "/labs/"]) {
  if (!home.includes(`href="${href}"`)) fail(`homepage missing crawlable ${href}`);
}

const pages = countHtml(dist);
if (pages < 100) fail(`expected 100+ prerendered pages, found ${pages}`);

console.log(`prerender verify ok — ${pages} HTML pages, keywords present in grade-7/science`);
