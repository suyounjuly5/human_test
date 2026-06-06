import type { ChallengeTelemetry } from "../types";

export interface TelemetryCollector {
  getPayload: (challengeId: string, extras?: Partial<ChallengeTelemetry>) => ChallengeTelemetry;
  onFocus: () => void;
  onBlur: () => void;
  onPointerMove: () => void;
  onKeypress: () => void;
  onPaste: () => void;
  onDelete: () => void;
  recordEdit: (value: string) => void;
}

export function createTelemetryCollector(): TelemetryCollector {
  const startTime = Date.now();
  let focusBlurCount = 0;
  let pointerMoveCount = 0;
  let keypressCount = 0;
  let pasteCount = 0;
  let deleteCount = 0;
  const editHistory: string[] = [];

  return {
    onFocus: () => {
      focusBlurCount++;
    },
    onBlur: () => {
      focusBlurCount++;
    },
    onPointerMove: () => {
      pointerMoveCount++;
    },
    onKeypress: () => {
      keypressCount++;
    },
    onPaste: () => {
      pasteCount++;
    },
    onDelete: () => {
      deleteCount++;
    },
    recordEdit: (value: string) => {
      editHistory.push(value.slice(-50));
      if (editHistory.length > 20) editHistory.shift();
    },
    getPayload: (challengeId: string, extras = {}) => ({
      challengeId,
      startTime,
      endTime: Date.now(),
      elapsedMs: Date.now() - startTime,
      focusBlurCount,
      pointerMoveCount,
      keypressCount,
      pasteCount,
      deleteCount,
      editHistory: [...editHistory],
      viewport: {
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      },
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      ...extras,
    }),
  };
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("hfcl_session_id");
}

export function setSessionId(id: string): void {
  sessionStorage.setItem("hfcl_session_id", id);
}

export function clearSessionId(): void {
  sessionStorage.removeItem("hfcl_session_id");
}
