import Link from "next/link";
import { UI } from "@/lib/ko";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-10 text-4xl font-bold tracking-tight sm:text-5xl">
        {UI.appName}
      </h1>
      <Link
        href="/test"
        className="inline-flex min-h-16 items-center justify-center rounded-lg bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        {UI.landingStart}
      </Link>
    </main>
  );
}
