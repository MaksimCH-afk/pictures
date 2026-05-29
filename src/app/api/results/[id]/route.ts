import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeResult } from "@/lib/serialize";
import { invalidateTags, CacheTags } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Update a single result: star rating and/or pin state.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.rating === "number") {
    data.rating = Math.max(0, Math.min(5, Math.round(body.rating)));
  }
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;

  try {
    const result = await prisma.result.update({ where: { id }, data });
    if ("rating" in data) invalidateTags(CacheTags.analytics);
    return NextResponse.json({ result: serializeResult(result) });
  } catch {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }
}
