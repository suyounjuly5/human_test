"use client";

import Image from "next/image";
import { useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

export default function RamenImageChallenge({ config, telemetry, onComplete }: Props) {
  const images = (config.images as string[]) ?? [];
  const minChars = (config.minChars as number | undefined) ?? 1;
  const [answer, setAnswer] = useState("");
  const trimmedLength = answer.trim().length;
  const canSubmit = trimmedLength >= minChars;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onComplete({ answer: answer.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {images.map((src, i) => (
          <div
            key={src}
            className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/[0.14] bg-black/30"
          >
            <Image
              src={src}
              alt={`라면 사진 ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>

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
        rows={5}
        placeholder={UI.ramenPlaceholder}
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
