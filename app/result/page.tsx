"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UI } from "@/lib/ko";

export default function ResultPage() {
  const [verdict, setVerdict] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    setVerdict(sessionStorage.getItem("hfcl_verdict"));
    setLabel(sessionStorage.getItem("hfcl_verdict_label"));
    setSummary(sessionStorage.getItem("hfcl_verdict_summary"));
  }, []);

  const isHuman = verdict === "likely_human";
  const hasResult = Boolean(label);

  return (
    <main
      className="dark-page flex items-center justify-center px-4 text-center"
    >
      <div className="w-full max-w-2xl space-y-6">
        <p
          className={`dark-panel rounded-lg px-10 py-8 text-3xl font-bold ${
            hasResult
              ? isHuman
                ? "text-green-200"
                : "text-red-200"
              : "text-white/75"
          }`}
        >
          {label ?? UI.resultEmpty}
        </p>
        {summary && (
          <div
            className="dark-panel whitespace-pre-line rounded-lg px-6 py-5 text-left text-base leading-7 text-white/[0.82]"
          >
            {summary}
          </div>
        )}
        <Link
          href="/"
          className="dark-button inline-flex rounded-lg px-7 py-3 font-semibold"
        >
          테스트 다시하기
        </Link>
      </div>
    </main>
  );
}
