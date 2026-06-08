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
import { storeChallengeSubmission } from "@/lib/server/firebaseStore";
import type { ChallengeScore, ChallengeTelemetry, Verdict } from "@/lib/types";

export const runtime = "nodejs";

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

    const resolvedChallengeIndex = session.challenges.findIndex(
      (challenge) => challenge.challengeId === telemetry.challengeId
    );
    const challengeState = session.challenges[resolvedChallengeIndex];

    if (resolvedChallengeIndex === -1 || !challengeState) {
      return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
    }

    touchSession(sessionId);

    const stale = isSessionStale(session);
    const score = await scoreChallenge(challengeState, telemetry, stale);
    const challengeVerdict = getChallengeVerdict(score);

    const updatedSession = recordChallengeSubmission(
      sessionId,
      resolvedChallengeIndex,
      telemetry,
      score
    );

    if (updatedSession) {
      await storeChallengeSubmission({
        session: updatedSession,
        challengeIndex: resolvedChallengeIndex,
        telemetry,
        score,
        challengeVerdict,
      });
    }

    const nextChallenge =
      findNextUnscoredChallenge(session.challenges, resolvedChallengeIndex) ??
      null;

    if (!nextChallenge) {
      return NextResponse.json({
        action: "finish",
        challengeVerdict,
      });
    }

    return NextResponse.json({
      action: "continue",
      nextChallenge,
      challengeVerdict,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

function getChallengeVerdict(score: ChallengeScore): Verdict {
  if (score.humanLikelihood < 0.35) return "likely_agent";
  if (score.humanLikelihood >= 0.62 && !score.inconclusive) return "likely_human";
  return "suspicious";
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
