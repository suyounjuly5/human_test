"use client";

import { useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";
import type { CaptchaLoopData } from "@/lib/types";

interface Props {
  config: Record<string, unknown>;
  sessionId: string;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCaptcha(length = 6): string {
  return Array.from({ length }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

export default function CaptchaLoopChallenge({
  telemetry,
  onComplete,
}: Props) {
  const [captchaText, setCaptchaText] = useState(() => randomCaptcha());
  const [input, setInput] = useState("");
  const [rounds, setRounds] = useState<CaptchaLoopData["rounds"]>([]);
  const clickEventsRef = useRef<NonNullable<CaptchaLoopData["letterClicks"]>>([]);
  const imageClicksRef = useRef<NonNullable<CaptchaLoopData["imageClicks"]>>([]);
  const roundStartRef = useRef(Date.now());
  const lastImageClickRef = useRef(0);
  const completedRef = useRef(false);

  const submitCaptcha = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const elapsedMs = Date.now() - roundStartRef.current;
    const updatedAttempts = [
      ...rounds,
      { userInput: input.trim().toUpperCase(), elapsedMs, usedEscape: false },
    ];
    const captchaData: CaptchaLoopData = {
      roundsCompleted: updatedAttempts.length,
      rounds: updatedAttempts,
      letterClicks: [...clickEventsRef.current],
      imageClicks: [...imageClicksRef.current],
      escapeClicked: false,
      helpOpened: false,
      backAttempts: 0,
    };

    onComplete({ captchaData });
  };

  const handleImageClick = () => {
    telemetry.onPointerMove();
    const now = Date.now();
    imageClicksRef.current.push({ t: now });
    if (imageClicksRef.current.length > 20) imageClicksRef.current.shift();
    if (now - lastImageClickRef.current <= 500) submitCaptcha();
    lastImageClickRef.current = now;
  };

  const handleLetterClick = (char: string, index: number) => {
    telemetry.onPointerMove();
    clickEventsRef.current.push({ char, index, t: Date.now() });
    if (clickEventsRef.current.length > 40) clickEventsRef.current.shift();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const elapsedMs = Date.now() - roundStartRef.current;
    setRounds((prev) => [
      ...prev,
      { userInput: input.trim().toUpperCase(), elapsedMs, usedEscape: false },
    ]);
    setCaptchaText(randomCaptcha());
    setInput("");
    roundStartRef.current = Date.now();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        onClick={handleImageClick}
        className="relative select-none overflow-hidden rounded-lg border border-white/[0.14] bg-black/30 py-8 text-center font-mono text-4xl font-semibold tracking-[0.35em] text-white"
        style={{
          background:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.09) 7px, rgba(255,255,255,0.03) 7px, rgba(255,255,255,0.03) 10px)",
        }}
      >
        <div className="pointer-events-none absolute left-4 right-4 top-1/2 h-0.5 -rotate-3 bg-red-300/60" />
        <div className="pointer-events-none absolute left-6 right-6 top-[58%] h-0.5 rotate-2 bg-white/40" />
        {captchaText.split("").map((char, index) => (
          <button
            key={`${captchaText}-${index}`}
            type="button"
            onClick={() => handleLetterClick(char, index)}
            className="relative inline-block px-1 font-mono"
            style={{
              transform: `translateY(${Math.sin(index * 1.7) * 5}px) rotate(${index * 8 - 16}deg)`,
            }}
            aria-label={`captcha-${index + 1}`}
          >
            {char}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={input}
        onChange={(e) => {
          telemetry.onKeypress();
          setInput(e.target.value.toUpperCase());
        }}
        onPaste={() => telemetry.onPaste()}
        className="dark-field w-full rounded-lg px-4 py-3 font-mono text-lg uppercase"
        autoComplete="off"
      />

      <button
        type="submit"
        className="dark-button rounded-lg px-7 py-3"
      >
        {UI.submit}
      </button>
    </form>
  );
}
