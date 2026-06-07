"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientChallengeConfig } from "@/lib/types";
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

interface Props {
  initialChallenge: ClientChallengeConfig;
  allChallenges: ClientChallengeConfig[];
  sessionId: string;
}

export default function ChallengeRunner({
  initialChallenge,
  allChallenges,
  sessionId,
}: Props) {
  const router = useRouter();
  const [challenge, setChallenge] = useState(initialChallenge);
  const [challengeList] = useState(
    allChallenges.length > 0 ? allChallenges : [initialChallenge]
  );
  const [completedIndexes, setCompletedIndexes] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [assessment, setAssessment] = useState<{
    label: string;
    canContinue: boolean;
    nextChallenge?: ClientChallengeConfig;
  } | null>(null);
  const telemetryRef = useRef<TelemetryCollector>(createTelemetryCollector());

  useEffect(() => {
    telemetryRef.current = createTelemetryCollector();
    setError(null);
    setAssessment(null);
  }, [challenge.challengeId]);

  const handleComplete = useCallback(
    async (extras: Record<string, unknown>) => {
      if (submitting) return;
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

        const data = await res.json();

        if (data.action === "retry") {
          telemetryRef.current = createTelemetryCollector();
          if (data.nextChallenge) setChallenge(data.nextChallenge);
          setRetryCount((count) => count + 1);
          setError(data.message ?? UI.errorGeneric);
          setSubmitting(false);
          return;
        }

        if (data.action === "assessment") {
          if (data.canContinue) {
            setCompletedIndexes((prev) => new Set(prev).add(challenge.index));
          }
          setAssessment({
            label: data.assessmentLabel ?? UI.verdictSuspicious,
            canContinue: Boolean(data.canContinue),
            nextChallenge: data.nextChallenge,
          });
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
          }

          router.push("/result");
          return;
        }

        if (data.nextChallenge) {
          setChallenge(data.nextChallenge);
          setSubmitting(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : UI.errorGeneric);
        setSubmitting(false);
      }
    },
    [challenge, sessionId, submitting, router]
  );

  const telemetry = telemetryRef.current;

  const handleAssessmentNext = () => {
    if (!assessment?.nextChallenge) return;
    setChallenge(assessment.nextChallenge);
    setAssessment(null);
  };

  const handleAssessmentRetry = () => {
    telemetryRef.current = createTelemetryCollector();
    setRetryCount((count) => count + 1);
    setAssessment(null);
    setError(null);
  };

  const handleSelectChallenge = (selected: ClientChallengeConfig) => {
    if (submitting) return;
    telemetryRef.current = createTelemetryCollector();
    setChallenge(selected);
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
          <ReflectionChallenge telemetry={telemetry} onComplete={handleComplete} />
        );
      case "opinion":
        return (
          <OpinionChallenge
            config={challenge.config}
            telemetry={telemetry}
            onComplete={handleComplete}
          />
        );
      case "discrimination-safety":
      case "relationship-opinion":
        return (
          <ReflectionChallenge telemetry={telemetry} onComplete={handleComplete} />
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

  const assessmentIsHuman = assessment?.label === UI.verdictLikelyHuman;
  const isTimingChallenge = challenge.challengeType === "timing";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <ProgressBar current={challenge.index} total={challenge.total} />

      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {challengeList.map((item) => {
          const isActive = item.challengeId === challenge.challengeId;
          const isCompleted = completedIndexes.has(item.index);
          return (
            <button
              key={item.challengeId}
              type="button"
              onClick={() => handleSelectChallenge(item)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : isCompleted
                    ? "border-green-200 bg-green-50 text-green-800 hover:border-green-300"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {item.index + 1}
            </button>
          );
        })}
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
        <h2
          className={`mb-8 text-center font-semibold leading-relaxed tracking-normal text-neutral-950 ${
            isTimingChallenge ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
          }`}
        >
          {challenge.prompt}
        </h2>

        {challenge.warning && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {challenge.warning}
          </div>
        )}

        {assessment ? (
          <div
            className={`space-y-6 rounded-lg border p-8 text-center ${
              assessmentIsHuman
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <p className="text-4xl font-bold sm:text-5xl">{assessment.label}</p>
            {assessment.canContinue ? (
              <button
                type="button"
                onClick={handleAssessmentNext}
                className="rounded-lg bg-green-700 px-8 py-3 text-base font-semibold text-white hover:bg-green-800"
              >
                {UI.next}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAssessmentRetry}
                className="rounded-lg bg-red-700 px-8 py-3 text-base font-semibold text-white hover:bg-red-800"
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
          <p className="mt-4 text-center text-sm text-neutral-500">{UI.processing}</p>
        )}
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
