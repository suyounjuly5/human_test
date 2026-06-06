"use client";

import { useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function OpinionChallenge({ telemetry, onComplete }: Props) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onComplete({
      selectedOption: "freeform",
      answer: answer.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <textarea
        value={answer}
        onChange={(e) => {
          telemetry.onKeypress();
          telemetry.recordEdit(e.target.value);
          setAnswer(e.target.value);
        }}
        onPaste={() => telemetry.onPaste()}
        onFocus={() => telemetry.onFocus()}
        onBlur={() => telemetry.onBlur()}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") telemetry.onDelete();
        }}
        rows={6}
        placeholder={UI.opinionPlaceholder}
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
