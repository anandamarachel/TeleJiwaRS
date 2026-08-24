"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleHomePath } from "@/lib/roleRouting";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(getRoleHomePath(user.role));
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-sm text-ink-700/70">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-jade-500/10">
        <span className="text-xl font-semibold text-jade-700">TJ</span>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-ink-900">Telemedicine Jiwa</h1>
        <p className="max-w-sm text-sm text-ink-700/70">
          Konsultasi kesehatan jiwa daring bersama dokter, dari mana saja.
          Mulai dengan skrining awal, dan lanjutkan konsultasi setelah pembayaran dikonfirmasi.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-jade-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-jade-600"
        >
          Daftar
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-sage-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-900 transition hover:border-jade-500"
        >
          Masuk
        </Link>
      </div>
    </div>
  );
}