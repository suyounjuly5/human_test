import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  finishSession,
  checkRateLimit,
} from "@/lib/server/sessionStore";
import { computeVerdict, getVerdictLabel } from "@/lib/server/scoring";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId as string;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.finished) {
      return NextResponse.json({
        verdict: session.verdict,
        verdictLabel: getVerdictLabel(session.verdict!),
        sessionId: session.id,
      });
    }

    const verdict = computeVerdict(session);
    finishSession(sessionId, verdict);

    return NextResponse.json({
      verdict,
      verdictLabel: getVerdictLabel(verdict),
      sessionId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
