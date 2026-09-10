import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const memory = new Map<string, unknown>();

export function dataDir() {
  return process.env.DATA_DIR || join(process.cwd(), ".data");
}

export function resetPersistCache() {
  memory.clear();
}

function filePath(name: string) {
  return join(dataDir(), name);
}

export function loadJson<T>(name: string, fallback: T): T {
  if (memory.has(name)) return memory.get(name) as T;
  try {
    const parsed = JSON.parse(readFileSync(filePath(name), "utf8")) as T;
    memory.set(name, parsed);
    return parsed;
  } catch {
    memory.set(name, fallback);
    return fallback;
  }
}

export function saveJson(name: string, value: unknown) {
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

export function appendJsonl(name: string, row: unknown) {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath(name), `${JSON.stringify(row)}\n`, { flag: "a" });
}
