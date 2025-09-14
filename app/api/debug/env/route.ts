import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env.local");
  const envExists = fs.existsSync(envPath);
  const envSize = envExists ? fs.statSync(envPath).size : 0;

  return NextResponse.json({
    cwd,
    envPath,
    envExists,
    envSize,
    hasCOC_TOKEN: Boolean(process.env.COC_TOKEN),
    tokenLength: (process.env.COC_TOKEN || "").length,
    NEXT_PUBLIC_CLAN_TAG: process.env.NEXT_PUBLIC_CLAN_TAG || "",
  });
}
