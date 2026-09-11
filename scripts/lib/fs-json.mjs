import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const memory = new Map();

export function dataDir() {
  return process.env.DATA_DIR || join(process.cwd(), ".data");
}

function filePath(name) {
  return join(dataDir(), name);
}

export function loadJson(name, fallback) {
  if (memory.has(name)) return memory.get(name);
  try {
    const parsed = JSON.parse(readFileSync(filePath(name), "utf8"));
    memory.set(name, parsed);
    return parsed;
  } catch {
    memory.set(name, fallback);
    return fallback;
  }
}

export function saveJson(name, value) {
  memory.set(name, value);
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const file = filePath(name);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  try {
    renameSync(tmp, file);
  } catch {
    writeFileSync(file, JSON.stringify(value));
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}
