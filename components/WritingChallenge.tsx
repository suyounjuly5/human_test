"use client";

import { useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
  minChars?: number;
  situation?: string;
  placeholder?: string;
}

export default function WritingChallenge({
  telemetry,
  onComplete,
  minChars = 1,
  situation,
  placeholder = UI.reflectionPlaceholder,
}: Props) {
  const [answer, setAnswer] = useState("");
  const firstKeyRef = useRef<number | null>(null);
  const trimmedLength = answer.trim().length;
  const canSubmit = trimmedLength >= minChars;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (firstKeyRef.current === null && value.length > 0) {
      firstKeyRef.current = Date.now();
    }
    telemetry.onKeypress();
    telemetry.recordEdit(value);
    setAnswer(value);
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
      {situation && (
        <div className="rounded-lg border border-white/[0.14] bg-black/[0.24] px-4 py-3 text-sm leading-6 text-white/[0.64]">
          {situation}
        </div>
      )}

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
        placeholder={placeholder}
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
