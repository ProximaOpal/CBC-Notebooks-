import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { NextResponse } from "next/server";

export function privateContentRoot() {
  return process.env.CONTENT_ROOT || join(process.cwd(), ".data", "private-content");
}

function mimeFor(file: string) {
  const ext = extname(file).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export function findPrivateFile(kind: string, id: string) {
  const root = privateContentRoot();
  const safeKind = kind.replace(/[^a-z0-9-]/gi, "");
  const safeId = id.replace(/[^a-z0-9._-]/gi, "");
  const candidates = [
    join(root, safeKind, safeId),
    join(root, safeKind, `${safeId}.pdf`),
    join(root, safeKind, `${safeId}.mp3`),
    join(root, safeKind, `${safeId}.mp4`),
  ];
  for (const file of candidates) {
    const abs = normalize(file);
    if (!abs.startsWith(normalize(root))) continue;
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

export function streamPrivateFile(file: string) {
  const stream = createReadStream(file);
  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mimeFor(file),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline; filename=\"view\"",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
