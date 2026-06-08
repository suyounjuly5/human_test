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
            ? "border-white/24 bg-white/[0.08] text-white"
            : "border-white/10 bg-black/25 text-transparent"
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
          className="dark-field w-full rounded-lg px-4 py-3 text-lg"
          autoComplete="off"
        />
        <button
          type="submit"
          className="dark-button rounded-lg px-7 py-3"
        >
          {UI.submit}
        </button>
      </form>
    </div>
  );
}
