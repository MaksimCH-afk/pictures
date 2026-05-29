import { NextRequest, NextResponse } from "next/server";
import { readLogSlice } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Incremental, real-time log reads.
//   ?file=project.log&offset=N   -> { text, size } (new bytes since offset)
//   ?file=project.log&download=1 -> full file as a download
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const file = sp.get("file") || "project.log";
  const download = sp.get("download") === "1";
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);

  let slice: { text: string; size: number };
  try {
    slice = readLogSlice(file, download ? 0 : offset);
  } catch {
    return NextResponse.json({ error: "Invalid log file" }, { status: 400 });
  }

  if (download) {
    return new NextResponse(slice.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  }

  return NextResponse.json({ text: slice.text, size: slice.size, offset });
}
