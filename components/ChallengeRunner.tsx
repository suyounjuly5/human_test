"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientChallengeConfig, SubmitResponse } from "@/lib/types";
import {
  createTelemetryCollector,
  type TelemetryCollector,
} from "@/lib/client/telemetry";
import { UI } from "@/lib/ko";
import ProgressBar from "./ProgressBar";
import DeviceMotionChallenge from "./DeviceMotionChallenge";
import TimingChallenge from "./TimingChallenge";
import HiddenTextChallenge from "./HiddenTextChallenge";
import ReflectionChallenge from "./ReflectionChallenge";
import OpinionChallenge from "./OpinionChallenge";
import RamenImageChallenge from "./RamenImageChallenge";
import ShapeTracingChallenge from "./ShapeTracingChallenge";
import CaptchaLoopChallenge from "./CaptchaLoopChallenge";
import WritingChallenge from "./WritingChallenge";
import EmergencyContactChallenge from "./EmergencyContactChallenge";
import VoiceNunchiChallenge from "./VoiceNunchiChallenge";

interface Props {
  initialChallenge: ClientChallengeConfig;
  allChallenges: ClientChallengeConfig[];
  sessionId: string;
}

const CHALLENGE_BACKGROUND_CLASSES = [
  "challenge-bg-finger",
  "challenge-bg-eye",
  "challenge-bg-body",
  "challenge-bg-finger",
  "challenge-bg-brain",
  "challenge-bg-head",
  "challenge-bg-leg",
  "challenge-bg-body",
  "challenge-bg-eye",
  "challenge-bg-brain",
  "challenge-bg-head",
  "challenge-bg-body",
];

export default function ChallengeRunner({
  initialChallenge,
  allChallenges,
  sessionId,
}: Props) {
  const router = useRouter();
  const [challenge, setChallenge] = useState(initialChallenge);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [assessment, setAssessment] = useState<{
    label: string;
    canContinue: boolean;
    nextChallenge?: ClientChallengeConfig;
  } | null>(null);
  const telemetryRef = useRef<TelemetryCollector>(createTelemetryCollector());
  const submittingRef = useRef(false);
  const humanSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setError(null);
    setAssessment(null);
  }, [challenge.challengeId]);

  const moveToChallenge = useCallback((nextChallenge: ClientChallengeConfig) => {
    telemetryRef.current = createTelemetryCollector();
    setChallenge(nextChallenge);
  }, []);

  const playHumanSound = useCallback(() => {
    if (!humanSoundRef.current) {
      humanSoundRef.current = new Audio("/assets/glass.mp3");
    }

    const audio = humanSoundRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browsers may block audio if the page has not received a trusted gesture.
    });
  }, []);

  const handleComplete = useCallback(
    async (extras: Record<string, unknown>) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);

      const payload = telemetryRef.current.getPayload(challenge.challengeId, extras);

      try {
        const res = await fetch("/api/challenge/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            challengeIndex: challenge.index,
            telemetry: payload,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? UI.errorSubmit);
        }

        const data = (await res.json()) as SubmitResponse;

        if (data.challengeVerdict === "likely_human") {
          playHumanSound();
        }

        if (data.action === "retry") {
          telemetryRef.current = createTelemetryCollector();
          if (data.nextChallenge) setChallenge(data.nextChallenge);
          setRetryCount((count) => count + 1);
          setError(data.message ?? UI.errorGeneric);
          submittingRef.current = false;
          setSubmitting(false);
          return;
        }

        if (data.action === "assessment") {
          setAssessment({
            label: data.assessmentLabel ?? UI.verdictSuspicious,
            canContinue: Boolean(data.canContinue),
            nextChallenge: data.nextChallenge,
          });
          submittingRef.current = false;
          setSubmitting(false);
          return;
        }

        if (data.action === "finish") {
          const finishRes = await fetch("/api/session/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });

          if (finishRes.ok) {
            const finishData = await finishRes.json();
            sessionStorage.setItem("hfcl_verdict", finishData.verdict);
            sessionStorage.setItem("hfcl_verdict_label", finishData.verdictLabel);
            sessionStorage.setItem("hfcl_verdict_summary", finishData.verdictSummary ?? "");
          }

          router.push("/result");
          return;
        }

        if (data.nextChallenge) {
          moveToChallenge(data.nextChallenge);
          submittingRef.current = false;
          setSubmitting(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : UI.errorGeneric);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [challenge, sessionId, router, moveToChallenge, playHumanSound]
  );

  const telemetry = telemetryRef.current;

  const handleAssessmentNext = () => {
    if (!assessment?.nextChallenge) return;
    moveToChallenge(assessment.nextChallenge);
    setAssessment(null);
  };

  const handleAssessmentRetry = () => {
    telemetryRef.current = createTelemetryCollector();
    setRetryCount((count) => count + 1);
    setAssessment(null);
    setError(null);
  };

  const renderChallenge = () => {
    switch (challenge.challengeType) {
      case "device-motion":
        return (
          <DeviceMotionChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "timing":
        return (
          <TimingChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "hidden-text":
        return (
          <HiddenTextChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "reflection":
        return (
          <ReflectionChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "opinion":
        return (
          <OpinionChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "relationship-opinion":
        return (
          <WritingChallenge
            telemetry={telemetry}
            onComplete={handleComplete}
            minChars={(challenge.config.minChars as number) ?? 50}
            situation={challenge.config.situation as string | undefined}
            placeholder={(challenge.config.placeholder as string | undefined) ?? UI.reflectionPlaceholder}
          />
        );
      case "emergency-contact":
        return (
          <EmergencyContactChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "discrimination-safety":
        return (
          <WritingChallenge
            telemetry={telemetry}
            onComplete={handleComplete}
            minChars={(challenge.config.minChars as number) ?? 150}
            placeholder={(challenge.config.placeholder as string | undefined) ?? UI.reflectionPlaceholder}
          />
        );
      case "ramen-image":
        return (
          <RamenImageChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "shape-tracing":
        return (
          <ShapeTracingChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "voice-nunchi":
        return (
          <VoiceNunchiChallenge
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "captcha-loop":
        return (
          <CaptchaLoopChallenge
            config={challenge.config}
            sessionId={sessionId}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  const assessmentIsHuman = Boolean(assessment?.canContinue);
  const minChars = challenge.config.minChars as number | undefined;
  const backgroundClass =
    CHALLENGE_BACKGROUND_CLASSES[challenge.index] ?? "challenge-bg-body";

  return (
    <>
      <div
        className={`challenge-page-bg ${backgroundClass}`}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <ProgressBar current={challenge.index} total={challenge.total} />

        <div className="dark-panel mb-6 rounded-lg p-7 sm:p-10">
          <h2
            className="mb-8 text-center text-xl font-semibold leading-relaxed tracking-normal text-white sm:text-2xl"
          >
            {challenge.prompt}
            {minChars && (
              <span className="ml-2 align-middle text-xs font-medium text-white/45">
                최소 {minChars}자
              </span>
            )}
          </h2>

          {challenge.warning && (
            <div className="mb-6 rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {challenge.warning}
            </div>
          )}

          {assessment ? (
            <div
              className={`space-y-6 rounded-lg border p-8 text-center ${
                assessmentIsHuman
                  ? "border-green-300/30 bg-green-500/10 text-green-100"
                  : "border-red-300/30 bg-red-500/10 text-red-100"
              }`}
            >
              <p className="text-4xl font-bold sm:text-5xl">{assessment.label}</p>
              {assessment.canContinue ? (
                <button
                  type="button"
                  onClick={handleAssessmentNext}
                  className="rounded-lg bg-green-500/[0.24] px-8 py-3 text-base font-semibold text-white hover:bg-green-500/[0.34]"
                >
                  {UI.next}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAssessmentRetry}
                  className="rounded-lg bg-red-500/[0.24] px-8 py-3 text-base font-semibold text-white hover:bg-red-500/[0.34]"
                >
                  {UI.retry}
                </button>
              )}
            </div>
          ) : (
            <div key={`${challenge.challengeId}-${retryCount}`}>
              {renderChallenge()}
            </div>
          )}

          {submitting && (
            <p className="mt-4 text-center text-sm text-white/55">{UI.processing}</p>
          )}
          {error && (
            <p className="mt-4 text-center text-sm text-red-300">{error}</p>
          )}
        </div>
      </div>
    </>
  );
}
