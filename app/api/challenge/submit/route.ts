import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  recordChallengeSubmission,
  checkRateLimit,
  isSessionStale,
  touchSession,
} from "@/lib/server/sessionStore";
import { getClientChallengeConfig } from "@/lib/server/challengeBank";
import { scoreChallenge } from "@/lib/server/scoring";
import type { ChallengeTelemetry } from "@/lib/types";

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
    const { sessionId, challengeIndex, telemetry } = body as {
      sessionId: string;
      challengeIndex: number;
      telemetry: ChallengeTelemetry;
    };

    if (!sessionId || challengeIndex == null || !telemetry) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.finished) {
      return NextResponse.json({ error: "Session already finished" }, { status: 400 });
    }

    const challengeState = session.challenges[challengeIndex];
    if (!challengeState || challengeState.challengeId !== telemetry.challengeId) {
      return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
    }

    touchSession(sessionId);

    const stale = isSessionStale(session);
    const score = await scoreChallenge(challengeState, telemetry, stale);

    recordChallengeSubmission(sessionId, challengeIndex, telemetry, score);

    const nextChallenge =
      findNextUnscoredChallenge(session.challenges, challengeIndex) ??
      null;

    if (!nextChallenge) {
      return NextResponse.json({ action: "finish" });
    }

    return NextResponse.json({
      action: "continue",
      nextChallenge,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

function findNextUnscoredChallenge(
  challenges: NonNullable<ReturnType<typeof getSession>>["challenges"],
  currentIndex: number
) {
  for (let offset = 1; offset <= challenges.length; offset++) {
    const index = (currentIndex + offset) % challenges.length;
    if (!challenges[index].score) {
      return getClientChallengeConfig(challenges, index);
    }
  }
  return null;
}
