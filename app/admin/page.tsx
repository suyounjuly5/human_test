"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@/lib/ko";
import type { AdminAttemptSummary } from "@/lib/types";

export default function AdminPage() {
  const [attempts, setAttempts] = useState<AdminAttemptSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/attempts");
        if (res.status === 403) {
          setError(UI.adminDisabled);
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setAttempts(data.attempts ?? []);
      } catch {
        setError(UI.errorGeneric);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{UI.adminTitle}</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          {UI.home}
        </Link>
      </div>

      <p className="mb-6 text-sm text-neutral-500">{UI.adminNote}</p>

      {loading && <p className="text-neutral-500">{UI.adminLoading}</p>}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {error}
        </div>
      )}

      {!loading && !error && attempts.length === 0 && (
        <p className="text-neutral-500">{UI.adminEmpty}</p>
      )}

      {attempts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">세션</th>
                <th className="px-4 py-3">생성 시각</th>
                <th className="px-4 py-3">판정</th>
                <th className="px-4 py-3">문항 수</th>
                <th className="px-4 py-3">평균 점수</th>
                <th className="px-4 py-3">플래그</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {attempts.map((a) => (
                <tr key={a.sessionId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {a.sessionId.slice(0, 8)}?
                  </td>
                  <td className="px-4 py-3 text-xs">{a.createdAt}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                      {a.verdict ?? "?"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.challengeCount}</td>
                  <td className="px-4 py-3">{a.avgHumanLikelihood}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {a.flagSummary.slice(0, 3).join(", ")}
                    {a.flagSummary.length > 3 && "?"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
