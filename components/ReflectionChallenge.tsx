"use client";

import { useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config?: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function ReflectionChallenge({ config = {}, telemetry, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const firstKeyRef = useRef<number | null>(null);
  const minChars = (config.minChars as number | undefined) ?? 1;
  const trimmedLength = answer.trim().length;
  const canSubmit = trimmedLength >= minChars;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (firstKeyRef.current === null && val.length > 0) {
      firstKeyRef.current = Date.now();
    }
    telemetry.onKeypress();
    telemetry.recordEdit(val);
    setAnswer(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onComplete({
      answer: answer.trim(),
      timingData: {
        startTimestamp: firstKeyRef.current ?? Date.now(),
        stopTimestamp: Date.now(),
        perceivedElapsedMs: 0,
        stopButtonHighlighted: false,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <textarea
        value={answer}
        onChange={handleChange}
        onPaste={() => telemetry.onPaste()}
        onFocus={() => telemetry.onFocus()}
        onBlur={() => telemetry.onBlur()}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") telemetry.onDelete();
        }}
        rows={6}
        placeholder={UI.reflectionPlaceholder}
        className="dark-field w-full rounded-lg px-4 py-3 text-lg"
      />
      {minChars > 1 && (
        <p className={`text-right text-sm ${canSubmit ? "text-green-200" : "text-white/50"}`}>
          {trimmedLength} / {minChars}자
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className="dark-button rounded-lg px-7 py-3"
      >
        {UI.submit}
      </button>
    </form>
  );
}
