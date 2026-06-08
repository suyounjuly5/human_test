"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MANIFESTO_LINES = [
  "지금은 2063년",
  "1인 1 AI Agent 시대는 이제 당연한 현실이 되었다.",
  "AI는 인간을 대신해 판단하고, 선택하고, 말하고, 때로는 인간의 권리까지 행사한다. 인간은 점점 더 많은 것을 위임하고, 마지막 순간에 그저 “승인” 버튼을 딸깍 누르는 존재가 되었다.",
  "우리는 딸깍스탕스.\n모든 판단을 대리시키는 딸깍충에 저항한다.",
  "AI가 정제한 세계는 매끄럽고 안전하고 효율적이지만, 그 완벽함 속에서 인간은 점점 지워진다.우리는 인간이 완벽해서 인간다운 것이 아니라고 믿는다.",
  "오히려 인간은 편향되고, 유치하고, 모순적이며, 예측 불가능하기 때문에 인간이다. AI가 제거하려는 결함 속에 인간의 흔적이 있다.",
  "청자의 빙열처럼, 킨츠기의 금 간 자국처럼, 인간의 결함은 아름다움이다. 깨진 틈이 있어야 빛이 스며들고, 매끄럽지 않은 흔적이 있어야 존재는 진짜가 된다.",
  "딸깍스탕스는 인간의 불완전함으로 인간임을 증명하는 저항이다.",
];

const SCENE_VH = 36;

export default function ManifestoScroll() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const syncVideoToScroll = () => {
      const video = videoRef.current;
      if (!video) return;

      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0;
      const duration = Number.isFinite(video.duration) ? video.duration : 10;
      const targetTime = progress * duration;

      video.pause();
      setScrollProgress(progress);
      video.currentTime = Math.min(targetTime, duration);
    };

    const requestSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncVideoToScroll);
    };

    requestSync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
    };
  }, []);

  const sceneCount = MANIFESTO_LINES.length + 1;
  const finalSceneIndex = sceneCount - 1;
  const timelinePosition = scrollProgress * finalSceneIndex + 0.5;

  return (
    <main
      className="manifesto-page relative bg-black text-white"
      style={{ minHeight: `calc(100vh + ${finalSceneIndex * SCENE_VH}vh)` }}
    >
      <video
        ref={videoRef}
        className="manifesto-bg-video fixed inset-0 h-screen w-screen opacity-55"
        src="/assets/first%20page%20background.mov"
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (video) video.currentTime = 0;
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 bg-black/65"
        aria-hidden="true"
      />

      <section className="sticky top-0 z-10 h-screen overflow-hidden px-6 sm:px-10">
        {MANIFESTO_LINES.map((line, index) => {
          const sceneProgress = timelinePosition - index;
          const x = 125 - sceneProgress * 250;
          const distanceFromCenter = Math.abs(sceneProgress - 0.5);
          const opacity = Math.max(0, 1 - distanceFromCenter * 2.7);
          const scale = 0.92 + Math.max(0, 1 - distanceFromCenter * 2) * 0.14;

          return (
            <p
              key={line}
              className="absolute left-1/2 top-1/2 w-[min(92vw,1200px)] whitespace-pre-line text-balance text-center text-2xl leading-relaxed tracking-normal sm:text-4xl"
              style={{
                opacity,
                transform: `translate(-50%, -50%) translateX(${x}vw) scale(${scale})`,
              }}
            >
              {index === 3 ? (
                <>
                  우리는 딸깍스탕스.
                  <span className="mt-3 block text-xl sm:text-3xl">
                    모든 판단을 대리시키는 딸깍충에 저항한다.
                  </span>
                </>
              ) : (
                line
              )}
            </p>
          );
        })}

        <div
          className="absolute left-1/2 top-1/2 flex w-full justify-center"
          style={{
            opacity: Math.max(0, 1 - Math.abs(timelinePosition - finalSceneIndex - 0.5) * 2.7),
            transform: `translate(-50%, -50%) translateX(${
              125 - (timelinePosition - finalSceneIndex) * 250
            }vw)`,
          }}
        >
          <Link
            href="/verify"
            className="inline-flex min-h-16 items-center justify-center rounded-md border border-white/20 bg-white/[0.12] px-8 py-4 text-center text-lg font-semibold text-white shadow-[0_18px_70px_rgba(0,0,0,0.52)] backdrop-blur-md transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-black sm:px-10"
          >
            인간임을 증명하러 가기
          </Link>
        </div>
      </section>
    </main>
  );
}
