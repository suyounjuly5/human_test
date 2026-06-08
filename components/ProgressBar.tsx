"use client";

import { UI } from "@/lib/ko";

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="mb-6 text-left text-xs font-medium text-white/50">
      {UI.progress(current, total)}
    </div>
  );
}
