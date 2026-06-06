import { NextRequest, NextResponse } from "next/server";
import { getAttemptLogs } from "@/lib/server/sessionStore";

export async function GET(request: NextRequest) {
  const debugMode = process.env.DEBUG_MODE === "true";

  if (!debugMode) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  // Production: add auth, IP allowlist, separate admin secret
  const attempts = getAttemptLogs();

  return NextResponse.json({ attempts, count: attempts.length });
}
