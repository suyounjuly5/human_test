"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChallengeRunner from "@/components/ChallengeRunner";
import { setSessionId, getSessionId } from "@/lib/client/telemetry";
import { UI } from "@/lib/ko";
import type { ClientChallengeConfig } from "@/lib/types";

export default function TestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSid] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ClientChallengeConfig | null>(null);
  const [challenges, setChallenges] = useState<ClientChallengeConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navigation?.type === "reload") {
        sessionStorage.removeItem("hfcl_session_id");
        router.replace("/");
        return;
      }

      const existing = getSessionId();
      if (existing) {
        sessionStorage.removeItem("hfcl_session_id");
      }

      try {
        const res = await fetch("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAgent: navigator.userAgent,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }),
        });

        if (!res.ok) throw new Error("Failed to start session");

        const data = await res.json();
        setSessionId(data.sessionId);
        setSid(data.sessionId);
        setChallenge(data.challenge);
        setChallenges(data.challenges ?? [data.challenge]);
      } catch {
        setError(UI.errorStart);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">{UI.preparing}</p>
      </main>
    );
  }

  if (error || !sessionId || !challenge) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600">{error ?? UI.errorGeneric}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-blue-600 underline"
        >
          {UI.home}
        </button>
      </main>
    );
  }

  return (
    <main>
      <header className="border-b border-neutral-200 bg-white px-4 py-3 text-center text-sm font-medium text-neutral-700">
        {UI.headerTest}
      </header>
      <ChallengeRunner
        initialChallenge={challenge}
        allChallenges={challenges}
        sessionId={sessionId}
      />
    </main>
  );
}
