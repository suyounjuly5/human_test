import { NextRequest, NextResponse } from "next/server";
import { createSession, checkRateLimit } from "@/lib/server/sessionStore";
import { getClientChallengeConfig } from "@/lib/server/challengeBank";

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
    const userAgent = body.userAgent ?? request.headers.get("user-agent") ?? "";
    const viewport = body.viewport ?? { width: 0, height: 0 };

    const session = createSession(userAgent, viewport, ip);
    const firstChallenge = getClientChallengeConfig(session.challenges, 0);
    const challenges = session.challenges
      .map((_, index) => getClientChallengeConfig(session.challenges, index))
      .filter(Boolean);

    return NextResponse.json({
      sessionId: session.id,
      challenge: firstChallenge,
      challenges,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
