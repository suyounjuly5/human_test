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
      <div
        className={`font-mono text-7xl tabular-nums text-white ${
          phase === "running" ? "invisible" : ""
        }`}
      >
        <span>{(elapsed / 1000).toFixed(1)}</span>
        <span className="ml-1 align-baseline text-3xl font-semibold text-white/50">
          초
        </span>
      </div>

      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="dark-button rounded-lg px-10 py-4 text-lg font-semibold"
        >
          {UI.start}
        </button>
      )}

      {phase === "running" && (
        <button
          type="button"
          onClick={handleStop}
          className="rounded-lg bg-red-500/30 px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-red-500/40"
        >
          {UI.stop}
        </button>
      )}

      {phase !== "done" && (
        <p className="text-sm text-white/45">{UI.timingKeyHint}</p>
      )}
    </div>
  );
}
