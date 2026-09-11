import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { contentGateError, requireEntitledUser } from "@/lib/content/gate";
import { findPrivateFile } from "@/lib/content/stream";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  try {
    const { kind, id } = await context.params;
    const safeKind = String(kind || "").toLowerCase();
    await requireEntitledUser(safeKind);
    const file = findPrivateFile(safeKind, id);
    if (!file) {
      return NextResponse.json({
        entitled: true,
        kind: safeKind,
        id,
        viewer: "canvas",
        downloadable: false,
      });
    }
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    const body = readFileSync(file);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline; filename=\"view\"",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return contentGateError(error);
  }
}
