"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { getRoleHomePath } from "@/lib/roleRouting";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !phoneNumber || !nik || !password || !confirmPassword) {
      setError("Semua kolom wajib diisi.");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (!/^\d{16}$/.test(nik)) {
      setError("NIK harus terdiri dari 16 digit angka.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setShowConfirmation(true);
  }

  async function submitRegistration() {
    setShowConfirmation(false);
    setIsSubmitting(true);
    try {
      await apiFetch("/patients/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          phone_number: phoneNumber,
          nik,
        }),
      });

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
            <p className="text-xs text-ink-700/70">Buat akun pasien baru</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nama lengkap" id="fullName">
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama sesuai KTP"
              className={inputClass}
            />
          </Field>

          <Field label="Email" id="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className={inputClass}
            />
          </Field>

          <Field label="Nomor WhatsApp" id="phoneNumber">
            <input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="08123456789"
              aria-describedby="phoneNumber-help"
              className={inputClass}
            />
            <p id="phoneNumber-help" className="text-xs leading-5 text-jade-700">
              Gunakan nomor WhatsApp yang aktif agar Anda dapat menerima informasi terkait konsultasi.
            </p>
          </Field>

          <Field label="Nomor Induk Kependudukan (NIK)" id="nik">
            <input
              id="nik"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="16 digit NIK sesuai KTP"
              minLength={16}
              maxLength={16}
              pattern="[0-9]{16}"
              aria-describedby="nik-help"
              className={inputClass}
            />
            <p id="nik-help" className="text-xs leading-5 text-ink-700/60">
              Digunakan untuk keperluan administrasi rumah sakit. Pastikan sesuai dengan KTP.
            </p>
          </Field>

          <Field label="Kata sandi" id="password">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className={inputClass}
            />
          </Field>

          <Field label="Konfirmasi kata sandi" id="confirmPassword">
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi"
              className={inputClass}
            />
          </Field>

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
            {isSubmitting ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-700/70">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-jade-700 hover:underline">
            Masuk
          </Link>
        </p>
      </div>

      {showConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-confirmation-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="registration-confirmation-title" className="text-lg font-semibold text-ink-900">
              Pastikan data Anda sudah benar
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-700/80">
              Periksa kembali nama lengkap, NIK, email, dan nomor WhatsApp. Data tersebut akan digunakan
              untuk akun serta administrasi konsultasi Anda.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="rounded-lg border border-sage-200 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-sage-50"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={submitRegistration}
                className="rounded-lg bg-jade-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-jade-600"
              >
                Data Sudah Benar, Daftar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      {children}
    </div>
  );
}
