import { NextResponse } from "next/server";
import archiver from "archiver";
import path from "node:path";
import fs from "node:fs";
import { LOGS_DIR, listLogFiles } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Download all log files (project + per-model) as a single ZIP.
export async function GET() {
  const files = listLogFiles();

  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });

  if (files.length === 0) {
    archive.append("no logs yet\n", { name: "README.txt" });
  }
  for (const f of files) {
    const disk = path.join(LOGS_DIR, f);
    if (fs.existsSync(disk)) archive.append(fs.createReadStream(disk), { name: f });
  }

  await archive.finalize();
  await done;

  const buf = Buffer.concat(chunks);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="imagegen-logs-${stamp}.zip"`,
    },
  });
}
