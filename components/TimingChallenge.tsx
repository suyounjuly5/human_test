"use client";

import { useEffect, useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function TimingChallenge({ telemetry, onComplete }: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<"idle" | "running" | "done">("idle");

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStart = () => {
    if (phaseRef.current !== "idle") return;
    telemetry.onPointerMove();
    startRef.current = Date.now();
    phaseRef.current = "running";
    setPhase("running");
    setElapsed(0);

    intervalRef.current = setInterval(() => {
      const ms = Date.now() - startRef.current;
      setElapsed(ms);
    }, 50);
  };

  const handleStop = () => {
    if (phaseRef.current !== "running") return;
    telemetry.onPointerMove();
    if (intervalRef.current) clearInterval(intervalRef.current);

    const stopTimestamp = Date.now();
    const perceivedElapsedMs = stopTimestamp - startRef.current;
    phaseRef.current = "done";
    setPhase("done");

    onComplete({
      timingData: {
        startTimestamp: startRef.current,
        stopTimestamp,
        perceivedElapsedMs,
        stopButtonHighlighted: false,
      },
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();

      if (phaseRef.current === "idle") {
        handleStart();
      } else if (phaseRef.current === "running") {
        handleStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="space-y-8 text-center">
      <div className="text-7xl font-mono tabular-nums text-neutral-800">
        <span>{(elapsed / 1000).toFixed(1)}</span>
        <span className="ml-1 align-baseline text-3xl font-semibold text-neutral-500">
          초
        </span>
      </div>

      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="rounded-lg bg-blue-600 px-10 py-4 text-lg font-semibold text-white hover:bg-blue-700"
        >
          {UI.start}
        </button>
      )}

      {phase === "running" && (
        <button
          type="button"
          onClick={handleStop}
          className="rounded-lg bg-red-600 px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-red-700"
        >
          {UI.stop}
        </button>
      )}

      {phase !== "done" && (
        <p className="text-sm text-neutral-400">{UI.timingKeyHint}</p>
      )}
    </div>
  );
}
