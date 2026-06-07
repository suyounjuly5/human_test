"use client";

import { useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function EmergencyContactChallenge({
  config,
  telemetry,
  onComplete,
}: Props) {
  const prefix = String(config.prefix ?? "010");
  const [target, setTarget] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const firstKeyRef = useRef<number | null>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);
  const isComplete = target.trim().length > 0 && middle.length === 4 && last.length === 4;

  const markTyping = (value: string) => {
    if (firstKeyRef.current === null && value.length > 0) {
      firstKeyRef.current = Date.now();
    }
    telemetry.onKeypress();
  };

  const limitSegment = (value: string) => value.replace(/[\s-]/g, "").slice(0, 4);

  const handleTargetChange = (value: string) => {
    markTyping(value);
    telemetry.recordEdit(`${value}|${prefix}-${middle}-${last}`);
    setTarget(value);
  };

  const handleMiddleChange = (value: string) => {
    const segment = limitSegment(value);
    markTyping(segment);
    telemetry.recordEdit(`${target}|${prefix}-${segment}-${last}`);
    setMiddle(segment);
    if (segment.length === 4) lastInputRef.current?.focus();
  };

  const handleLastChange = (value: string) => {
    const segment = limitSegment(value);
    markTyping(segment);
    telemetry.recordEdit(`${target}|${prefix}-${middle}-${segment}`);
    setLast(segment);
  };

  const handlePaste = (value: string) => {
    telemetry.onPaste();
    const compact = value.replace(/[\s-]/g, "");
    if (compact.length >= 8) {
      const withoutPrefix = compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
      const pastedMiddle = withoutPrefix.slice(0, 4);
      const pastedLast = withoutPrefix.slice(4, 8);
      setMiddle(pastedMiddle);
      setLast(pastedLast);
      telemetry.recordEdit(`${target}|${prefix}-${pastedMiddle}-${pastedLast}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete) return;
    onComplete({
      answer: `${prefix}-${middle}-${last}`,
      selectedOption: target.trim(),
      timingData: {
        startTimestamp: firstKeyRef.current ?? Date.now(),
        stopTimestamp: Date.now(),
        perceivedElapsedMs: 0,
        stopButtonHighlighted: false,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 text-center">
      <input
        aria-label="비상 연락 대상"
        value={target}
        onChange={(e) => handleTargetChange(e.target.value)}
        onPaste={() => telemetry.onPaste()}
        onFocus={() => telemetry.onFocus()}
        onBlur={() => telemetry.onBlur()}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") telemetry.onDelete();
        }}
        autoComplete="off"
        placeholder="구체적인 대상"
        className="mx-auto block h-11 w-full max-w-xs rounded-lg border border-neutral-300 px-4 text-center text-base font-semibold text-neutral-950 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-2xl font-semibold text-neutral-500">
          {prefix}
        </div>
        <span className="text-2xl font-semibold text-neutral-400">-</span>
        <input
          aria-label="비상 연락처 가운데 네 자리"
          value={middle}
          onChange={(e) => handleMiddleChange(e.target.value)}
          onPaste={(e) => handlePaste(e.clipboardData.getData("text"))}
          onFocus={() => telemetry.onFocus()}
          onBlur={() => telemetry.onBlur()}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") telemetry.onDelete();
          }}
          inputMode="text"
          autoComplete="off"
          maxLength={4}
          placeholder="□□□□"
          className="h-16 w-28 rounded-lg border border-neutral-300 text-center text-2xl font-semibold tracking-widest text-neutral-950 placeholder:text-neutral-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-32"
        />
        <span className="text-2xl font-semibold text-neutral-400">-</span>
        <input
          ref={lastInputRef}
          aria-label="비상 연락처 마지막 네 자리"
          value={last}
          onChange={(e) => handleLastChange(e.target.value)}
          onPaste={(e) => handlePaste(e.clipboardData.getData("text"))}
          onFocus={() => telemetry.onFocus()}
          onBlur={() => telemetry.onBlur()}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") telemetry.onDelete();
          }}
          inputMode="text"
          autoComplete="off"
          maxLength={4}
          placeholder="□□□□"
          className="h-16 w-28 rounded-lg border border-neutral-300 text-center text-2xl font-semibold tracking-widest text-neutral-950 placeholder:text-neutral-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-32"
        />
      </div>

      <button
        type="submit"
        disabled={!isComplete}
        className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-neutral-300"
      >
        {UI.submit}
      </button>
    </form>
  );
}
