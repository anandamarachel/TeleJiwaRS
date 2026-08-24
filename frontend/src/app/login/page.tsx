"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { getRoleHomePath } from "@/lib/roleRouting";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userInfo = await login(email, password);
      router.push(getRoleHomePath(userInfo.role));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-sage-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-500/10">
            <span className="text-lg font-semibold text-jade-700">TJ</span>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">Telemedicine Jiwa</p>
            <p className="text-xs text-ink-700/70">Masuk ke akun Anda</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink-900">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-lg bg-jade-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-jade-600 disabled:opacity-60"
          >
            {isSubmitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}