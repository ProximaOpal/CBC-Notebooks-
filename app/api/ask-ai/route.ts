import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { askAiPaywall, canAskAi, recordAiQuery } from "@/lib/payments/ai-quota";
import { SUBJECTS } from "../../../src/assets/js/data/subjects.js";

export const runtime = "nodejs";

function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SUBJECTS.filter((sub: { name: string; topics: { name: string; detail: string }[] }) =>
    (sub.name + " " + sub.topics.map((t) => t.name + " " + t.detail).join(" ")).toLowerCase().includes(q)
  )
    .slice(0, 8)
    .map((sub: { id: string; name: string; level: string; topics: { name: string }[] }) => ({
      id: sub.id,
      name: sub.name,
      level: sub.level,
      topics: sub.topics.slice(0, 4).map((t) => t.name),
    }));
}

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    throw error;
  }

  const body = await req.json().catch(() => ({}));
  const query = String(body.query || body.q || "").trim();
  if (!query) return NextResponse.json({ error: "Question is required" }, { status: 400 });

  const gate = canAskAi(user.id);
  if (!gate.allowed) {
    return NextResponse.json(askAiPaywall(), { status: 402 });
  }

  recordAiQuery(user.id, query);
  return NextResponse.json({
    ok: true,
    quota: gate,
    query,
    results: searchCatalog(query),
  });
}
