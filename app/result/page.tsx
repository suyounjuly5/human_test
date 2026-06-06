"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@/lib/ko";

export default function ResultPage() {
  const [verdict, setVerdict] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setVerdict(sessionStorage.getItem("hfcl_verdict"));
    setLabel(sessionStorage.getItem("hfcl_verdict_label"));
  }, []);

  const isHuman = verdict === "likely_human";
  const hasResult = Boolean(label);

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-4 text-center ${
        hasResult
          ? isHuman
            ? "bg-green-50"
            : "bg-red-50"
          : "bg-neutral-50"
      }`}
    >
      <div className="space-y-6">
        <p
          className={`rounded-lg border px-10 py-8 text-3xl font-bold shadow-sm ${
            hasResult
              ? isHuman
                ? "border-green-200 bg-white text-green-800"
                : "border-red-300 bg-white text-red-700"
              : "border-neutral-200 bg-white text-neutral-700"
          }`}
        >
          {label ?? UI.resultEmpty}
        </p>
        <Link
          href="/"
          className={`inline-flex rounded-lg px-7 py-3 font-semibold text-white ${
            isHuman ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"
          }`}
        >
          테스트 다시하기
        </Link>
      </div>
    </main>
  );
}
