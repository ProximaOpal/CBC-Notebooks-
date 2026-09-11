import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUBJECTS } from "../src/assets/js/data/subjects.js";
import { heroForSubject, heroForTopic, imaginePrompt, subjectPhotoPath, topicPhotoPath } from "../src/assets/js/data/chroma.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = [
  "# CBC Notebooks — Midjourney /imagine prompts",
  "# Chroma cloned from the exotic-birds reference (palette, mist, contrast only).",
  "# Forbidden: birds, kingfishers, feathers, beaks, hornbills, wildlife portraits.",
  "",
];

for (const subject of SUBJECTS) {
  lines.push(`## ${subject.name} (${subject.id})`);
  lines.push(`Cover → ${subjectPhotoPath(subject.id)}`);
  lines.push(imaginePrompt(heroForSubject(subject.name)));
  lines.push("");
  for (const topic of subject.topics) {
    lines.push(`### ${topic.name}  →  ${topicPhotoPath(topic.id)}`);
    lines.push(imaginePrompt(heroForTopic(topic.name, subject.name)));
    lines.push("");
  }
}

const out = join(root, "src", "assets", "img", "cbc-topic-imagine-prompts.txt");
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${out} (${SUBJECTS.reduce((n, s) => n + 1 + s.topics.length, 0)} prompts)`);
