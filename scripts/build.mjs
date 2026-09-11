import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prerenderAll } from "./lib/prerender.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, "src"), dist, { recursive: true });

const shell = readFileSync(join(root, "src", "index.html"), "utf8");
const { written, sitemaps } = prerenderAll(shell, dist);

console.log(`Built static site → dist/ (${written.length} prerendered HTML routes)`);
console.log(`Sitemaps: ${sitemaps.join(", ")}`);
