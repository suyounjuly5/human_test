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
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onComplete({ answer: answer.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {images.map((src, i) => (
          <div
            key={src}
            className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
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
