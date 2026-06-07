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
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
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
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {minChars > 1 && (
        <p className={`text-right text-sm ${canSubmit ? "text-green-700" : "text-neutral-500"}`}>
          {trimmedLength} / {minChars}자
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-blue-600 px-7 py-3 text-white hover:bg-blue-700 disabled:bg-neutral-300"
      >
        {UI.submit}
      </button>
    </form>
  );
}
