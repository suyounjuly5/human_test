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
      <main className="dark-page flex items-center justify-center">
        <p className="text-white/60">{UI.preparing}</p>
      </main>
    );
  }

  if (error || !sessionId || !challenge) {
    return (
      <main className="dark-page flex flex-col items-center justify-center gap-4">
        <p className="text-red-300">{error ?? UI.errorGeneric}</p>
        <button
          type="button"
          onClick={() => router.push("/verify")}
          className="text-white/75 underline hover:text-white"
        >
          {UI.home}
        </button>
      </main>
    );
  }

  return (
    <main className="dark-page">
      <header className="relative z-10 border-b border-white/10 bg-black/35 px-4 py-3 text-center text-sm font-medium text-white/70 backdrop-blur-md">
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
