import { NextRequest, NextResponse } from "next/server";
import { getSession, checkRateLimit } from "@/lib/server/sessionStore";

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
    const { sessionId, roundIndex } = body as {
      sessionId: string;
      roundIndex: number;
    };

    if (!sessionId || roundIndex == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const captchaChallenge = session.challenges.find(
      (c) => c.challengeType === "captcha-loop"
    );
    const texts = (captchaChallenge?.secrets.captchaTexts as string[]) ?? [];

    if (roundIndex < 0 || roundIndex >= texts.length) {
      return NextResponse.json({ error: "Invalid round" }, { status: 400 });
    }

    return NextResponse.json({
      captchaText: texts[roundIndex],
      roundIndex,
      isLast: roundIndex >= texts.length - 1,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
