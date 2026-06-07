"use client";

import { useEffect, useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function HiddenTextChallenge({ config, telemetry, onComplete }: Props) {
  const word = config.word as string;
  const textDelayMs = (config.textDelayMs as number) ?? 5000;

  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState("");
  const visibleAtRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      visibleAtRef.current = Date.now();
    }, textDelayMs);

    return () => clearTimeout(timer);
  }, [textDelayMs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittedRef.current) return;
    submittedRef.current = true;
    const stopTimestamp = Date.now();
    onComplete({
      answer: answer.trim(),
      timingData: {
        startTimestamp: visibleAtRef.current,
        stopTimestamp,
        perceivedElapsedMs: visibleAtRef.current ? stopTimestamp - visibleAtRef.current : 0,
        stopButtonHighlighted: true,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div
        className={`min-h-[104px] rounded-lg border p-6 text-center transition-colors ${
          visible
            ? "border-neutral-300 bg-white text-neutral-900"
            : "border-neutral-100 bg-white text-white"
        }`}
      >
        <p className="text-4xl font-semibold">{word}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={answer}
          onChange={(e) => {
            telemetry.onKeypress();
            telemetry.recordEdit(e.target.value);
            setAnswer(e.target.value);
          }}
          onPaste={() => telemetry.onPaste()}
          onFocus={() => telemetry.onFocus()}
          onBlur={() => telemetry.onBlur()}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-7 py-3 text-white hover:bg-blue-700"
        >
          {UI.submit}
        </button>
      </form>
    </div>
  );
}
