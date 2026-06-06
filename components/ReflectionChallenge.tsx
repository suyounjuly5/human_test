"use client";

import { useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function ReflectionChallenge({ telemetry, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const firstKeyRef = useRef<number | null>(null);

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
    if (!answer.trim()) return;
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
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={!answer.trim()}
        className="rounded-lg bg-blue-600 px-7 py-3 text-white hover:bg-blue-700 disabled:bg-neutral-300"
      >
        {UI.submit}
      </button>
    </form>
  );
}
