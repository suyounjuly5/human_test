import Link from "next/link";
import LandingBackgroundVideo from "@/components/LandingBackgroundVideo";
import { UI } from "@/lib/ko";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-black px-4 text-center text-white">
      <LandingBackgroundVideo />
      <div className="absolute inset-0 bg-black/[0.45]" aria-hidden="true" />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white drop-shadow-[0_6px_26px_rgba(0,0,0,0.9)] sm:text-6xl">
          {UI.appName}
        </h1>
        <div className="mt-10 bg-black/20 p-1 shadow-[0_18px_70px_rgba(0,0,0,0.52)] backdrop-blur-md">
          <Link
            href="/test"
            className="inline-flex min-h-16 items-center justify-center rounded-md bg-white/[0.12] px-10 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-black"
          >
            {UI.landingStart}
          </Link>
        </div>
      </section>
    </main>
  );
}
