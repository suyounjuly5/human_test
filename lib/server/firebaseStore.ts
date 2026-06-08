import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
} from "firebase-admin/firestore";
import type {
  ChallengeScore,
  ChallengeTelemetry,
  SessionRecord,
  Verdict,
} from "@/lib/types";

const COLLECTION_NAME =
  process.env.FIREBASE_ATTEMPTS_COLLECTION || "human_test_attempts";

function normalizeEnvValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function hasFirebaseConfig(): boolean {
  return Boolean(
    normalizeEnvValue(process.env.FIREBASE_PROJECT_ID) &&
      normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL) &&
      normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY)
  );
}

function normalizePrivateKey(privateKey: string): string {
  const key = normalizeEnvValue(privateKey).replace(/\\n/g, "\n");

  if (key.includes("\n")) return key;

  return key
    .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
    .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----")
    .replace(/-----BEGIN PRIVATE KEY-----\n\s+/, "-----BEGIN PRIVATE KEY-----\n")
    .replace(/\s+\n-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----");
}

function getDb() {
  if (!hasFirebaseConfig()) return null;

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: normalizeEnvValue(process.env.FIREBASE_PROJECT_ID),
          clientEmail: normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL),
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY ?? ""),
        }),
      });
    }

    return getFirestore();
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK", error);
    return null;
  }
}

function cleanForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof FieldValue) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => cleanForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      const cleaned = cleanForFirestore(item);
      if (cleaned !== undefined) result[key] = cleaned;
    }

    return result;
  }

  return value;
}

function getAverageHumanLikelihood(scores: ChallengeScore[]): number | null {
  if (scores.length === 0) return null;

  const avg =
    scores.reduce((sum, score) => sum + score.humanLikelihood, 0) /
    scores.length;

  return Math.round(avg * 100) / 100;
}

export async function loadSessionFromFirebase(
  sessionId: string
): Promise<SessionRecord | undefined> {
  const db = getDb();
  if (!db) return undefined;

  try {
    const snapshot = await db.collection(COLLECTION_NAME).doc(sessionId).get();
    const data = snapshot.data();
    return data?.serverState as SessionRecord | undefined;
  } catch (error) {
    console.error("Failed to load session from Firebase", error);
    return undefined;
  }
}

export async function storeSessionStarted(session: SessionRecord): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.collection(COLLECTION_NAME).doc(session.id).set(
      cleanForFirestore({
        sessionId: session.id,
        createdAt: new Date(session.createdAt).toISOString(),
        createdAtMs: session.createdAt,
        lastActivityAtMs: session.lastActivityAt,
        userAgent: session.userAgent,
        viewport: session.viewport,
        ipHash: session.ipHash,
        finished: session.finished,
        challengeCount: session.challenges.length,
        challengeTypes: session.challenges.map((challenge) => challenge.challengeType),
        serverState: session,
        savedAt: FieldValue.serverTimestamp(),
      }) as DocumentData,
      { merge: true }
    );
  } catch (error) {
    console.error("Failed to save session start to Firebase", error);
  }
}

export async function storeChallengeSubmission(params: {
  session: SessionRecord;
  challengeIndex: number;
  telemetry: ChallengeTelemetry;
  score: ChallengeScore;
  challengeVerdict: Verdict;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { session, challengeIndex, telemetry, score, challengeVerdict } = params;
  const challenge = session.challenges[challengeIndex];

  try {
    const sessionRef = db.collection(COLLECTION_NAME).doc(session.id);

    await sessionRef.set(
      cleanForFirestore({
        sessionId: session.id,
        lastActivityAtMs: session.lastActivityAt,
        currentIndex: session.currentIndex,
        finished: session.finished,
        challengeCount: session.challengeScores.length,
        avgHumanLikelihood: getAverageHumanLikelihood(session.challengeScores),
        serverState: session,
        updatedAt: FieldValue.serverTimestamp(),
      }) as DocumentData,
      { merge: true }
    );

    await sessionRef
      .collection("submissions")
      .doc(score.challengeId)
      .set(
        cleanForFirestore({
          sessionId: session.id,
          challengeIndex,
          challengeId: score.challengeId,
          challengeType: challenge?.challengeType ?? score.challengeType,
          challengeVerdict,
          answer: telemetry.answer,
          selectedOption: telemetry.selectedOption,
          humanLikelihood: score.humanLikelihood,
          flags: score.flags,
          inconclusive: score.inconclusive,
          score,
          telemetry,
          submittedAt: FieldValue.serverTimestamp(),
        }) as DocumentData,
        { merge: true }
      );
  } catch (error) {
    console.error("Failed to save challenge submission to Firebase", error);
  }
}

export async function storeSessionFinished(params: {
  session: SessionRecord;
  verdict: Verdict;
  verdictLabel: string;
  verdictSummary?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { session, verdict, verdictLabel, verdictSummary } = params;
  const flags = [...new Set(session.challengeScores.flatMap((score) => score.flags))];

  try {
    await db.collection(COLLECTION_NAME).doc(session.id).set(
      cleanForFirestore({
        sessionId: session.id,
        createdAt: new Date(session.createdAt).toISOString(),
        createdAtMs: session.createdAt,
        finishedAt: new Date(session.lastActivityAt).toISOString(),
        finishedAtMs: session.lastActivityAt,
        userAgent: session.userAgent,
        viewport: session.viewport,
        ipHash: session.ipHash,
        finished: true,
        verdict,
        verdictLabel,
        verdictSummary,
        challengeCount: session.challengeScores.length,
        avgHumanLikelihood: getAverageHumanLikelihood(session.challengeScores),
        flagSummary: flags.slice(0, 50),
        scores: session.challengeScores,
        serverState: session,
        updatedAt: FieldValue.serverTimestamp(),
      }) as DocumentData,
      { merge: true }
    );
  } catch (error) {
    console.error("Failed to save session finish to Firebase", error);
  }
}
