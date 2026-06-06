import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import type {
  ChallengeScore,
  ChallengeTelemetry,
  ChallengeType,
  SessionRecord,
  Verdict,
  AdminAttemptSummary,
} from "../types";
import { createSessionChallenges } from "./challengeBank";

interface PrototypeStore {
  sessions: Map<string, SessionRecord>;
  attemptLog: AdminAttemptSummary[];
  submissionCounts: Map<string, { count: number; resetAt: number }>;
}

declare global {
  var __humanFrictionStore: PrototypeStore | undefined;
}

// In-memory store for prototype. Keep it on globalThis so dev route reloads and
// separate route module evaluations do not lose active sessions.
const store =
  globalThis.__humanFrictionStore ??
  (globalThis.__humanFrictionStore = {
    sessions: new Map<string, SessionRecord>(),
    attemptLog: [],
    submissionCounts: new Map<string, { count: number; resetAt: number }>(),
  });

const sessions = store.sessions;
const attemptLog = store.attemptLog;

// Simple rate limiting: track submissions per IP hash
const submissionCounts = store.submissionCounts;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function hashIp(ip: string): string {
  const secret = process.env.APP_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16);
}

export function checkRateLimit(ip: string): boolean {
  const key = hashIp(ip);
  const now = Date.now();
  const entry = submissionCounts.get(key);

  if (!entry || now > entry.resetAt) {
    submissionCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export function createSession(
  userAgent: string,
  viewport: { width: number; height: number },
  ip?: string
): SessionRecord {
  const id = uuidv4();
  const now = Date.now();
  const session: SessionRecord = {
    id,
    createdAt: now,
    lastActivityAt: now,
    userAgent,
    viewport,
    currentIndex: 0,
    challenges: createSessionChallenges(),
    challengeScores: [],
    finished: false,
    ipHash: ip ? hashIp(ip) : undefined,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivityAt = Date.now();
  }
}

export function recordChallengeSubmission(
  sessionId: string,
  index: number,
  telemetry: ChallengeTelemetry,
  score: ChallengeScore
): SessionRecord | undefined {
  const session = sessions.get(sessionId);
  if (!session || session.finished) return undefined;

  session.lastActivityAt = Date.now();
  session.challenges[index].telemetry = telemetry;
  session.challenges[index].score = score;
  session.challengeScores = session.challengeScores.filter(
    (existing) => existing.challengeId !== score.challengeId
  );
  session.challengeScores.push(score);
  session.currentIndex = Math.max(session.currentIndex, index + 1);

  return session;
}

export function finishSession(
  sessionId: string,
  verdict: Verdict
): SessionRecord | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  session.finished = true;
  session.verdict = verdict;
  session.lastActivityAt = Date.now();

  const avg =
    session.challengeScores.length > 0
      ? session.challengeScores.reduce((s, c) => s + c.humanLikelihood, 0) /
        session.challengeScores.length
      : 0;

  const allFlags = session.challengeScores.flatMap((c) => c.flags);

  attemptLog.push({
    sessionId: session.id,
    createdAt: new Date(session.createdAt).toISOString(),
    finishedAt: new Date(session.lastActivityAt).toISOString(),
    verdict,
    challengeCount: session.challengeScores.length,
    avgHumanLikelihood: Math.round(avg * 100) / 100,
    flagSummary: [...new Set(allFlags)].slice(0, 20),
  });

  if (attemptLog.length > 500) {
    attemptLog.shift();
  }

  return session;
}

export function getAttemptLogs(): AdminAttemptSummary[] {
  return [...attemptLog].reverse();
}

export function isSessionStale(session: SessionRecord, maxIdleMs = 5 * 60_000): boolean {
  return Date.now() - session.lastActivityAt > maxIdleMs;
}
