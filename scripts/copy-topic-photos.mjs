import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUBJECTS } from "../src/assets/js/data/subjects.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const generated = join(root, "..", "..", ".cursor", "projects", "c-Users-grvns-Videos-New-folder-2", "assets");
const altGenerated = "C:/Users/grvns/.cursor/projects/c-Users-grvns-Videos-New-folder-2/assets";
const pool = existsSync(altGenerated) ? altGenerated : generated;
const subjectsDir = join(root, "src", "assets", "img", "subjects");
const topicsDir = join(root, "src", "assets", "img", "topics");
mkdirSync(subjectsDir, { recursive: true });
mkdirSync(topicsDir, { recursive: true });

function copyNamed(prefix, destDir) {
  if (!existsSync(pool)) return 0;
  let n = 0;
  for (const name of readdirSync(pool)) {
    if (!name.startsWith(prefix) || !name.endsWith(".png")) continue;
    const id = name.slice(prefix.length).replace(/\.png$/, "");
    copyFileSync(join(pool, name), join(destDir, `${id}.png`));
    n += 1;
  }
  return n;
}

const FAMILY = {
  "jss-kis": "up-kis",
  "jss-arts": "up-arts",
  "jss-ss": "up-ss",
  "jss-re": "up-re",
  "ss-eng": "jss-eng",
  "ss-kis": "up-kis",
  "ss-math": "jss-math",
  "ss-csl": "jss-life",
  "ss-pe": "up-phe",
  "ss-ict": "jss-tech",
  "ss-re": "up-re",
  "ss-phy": "jss-sci",
  "ss-chem": "jss-sci",
  "ss-bio": "jss-sci",
  "ss-applied": "jss-sci",
  "ss-avi": "jss-tech",
  "ss-power": "jss-tech",
  "ss-build": "jss-tech",
  "ss-elec": "jss-tech",
  "ss-cs": "jss-tech",
  "ss-agr": "jss-agr",
  "ss-hist": "up-ss",
  "ss-geo": "up-ss",
  "ss-bus": "jss-bus",
  "ss-lit": "jss-eng",
  "ss-fasihi": "up-kis",
  "ss-fr": "up-eng",
  "ss-de": "up-eng",
  "ss-ar": "up-kis",
  "ss-zh": "up-eng",
  "ss-art": "up-arts",
  "ss-music": "up-arts",
  "ss-theatre": "up-arts",
  "ss-sport": "up-phe",
};

const subjectsCopied = copyNamed("subject-", subjectsDir);
const topicsCopied = copyNamed("topic-", topicsDir);

let filled = 0;
for (const subject of SUBJECTS) {
  const dest = join(subjectsDir, `${subject.id}.png`);
  if (existsSync(dest)) continue;
  const family = FAMILY[subject.id];
  const src = family ? join(subjectsDir, `${family}.png`) : join(subjectsDir, "up-math.png");
  if (existsSync(src)) {
    copyFileSync(src, dest);
    filled += 1;
  }
}

console.log({ pool, subjectsCopied, topicsCopied, fallbacks: filled });
