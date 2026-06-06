"use client";

import { UI } from "@/lib/ko";

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <div className="mb-6">
      <div className="mb-1 flex justify-between text-xs text-neutral-500">
        <span>{UI.progress(current, total)}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
