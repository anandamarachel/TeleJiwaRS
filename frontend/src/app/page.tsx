"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { getRoleHomePath } from "@/lib/roleRouting";
import { PublicDoctorProfile } from "@/lib/types";

const consultationSteps = [
  ["01", "Isi skrining awal", "Ceritakan keluhan Anda dan jawab pertanyaan singkat untuk membantu dokter memahami kondisi awal."],
  ["02", "Kirim bukti pembayaran", "Ikuti instruksi pembayaran rumah sakit. Admin akan memeriksa bukti yang Anda unggah."],
  ["03", "Konsultasi dengan dokter", "Setelah disetujui, dokter mengambil konsultasi dan berbicara dengan Anda melalui chat pribadi."],
  ["04", "Terima ringkasan perawatan", "Lihat catatan, resep, jadwal tindak lanjut, atau rujukan setelah konsultasi selesai."],
];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [doctors, setDoctors] = useState<PublicDoctorProfile[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(getRoleHomePath(user.role));
  }, [user, isLoading, router]);

  useEffect(() => {
    apiFetch<PublicDoctorProfile[]>("/doctors/public")
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, []);

  if (isLoading || user) {
    return <div className="flex min-h-full flex-1 items-center justify-center"><p className="text-sm text-ink-700/70">Memuat...</p></div>;
  }

  return (
    <main className="min-h-full overflow-hidden bg-sage-50">
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-500 text-sm font-bold text-white">TJ</span>
          <span>
            <span className="block text-sm font-semibold text-ink-900">Telemedicine Jiwa</span>
            <span className="hidden text-[11px] text-ink-700/60 sm:block">Layanan kesehatan jiwa rumah sakit</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition hover:text-jade-700 sm:px-4">Masuk</Link>
          <Link href="/register" className="rounded-lg bg-jade-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-jade-600 sm:px-4">Mulai Konsultasi</Link>
        </div>
      </nav>

      <section className="relative">
        <div className="pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full bg-clay-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-56 h-80 w-80 rounded-full bg-jade-500/10 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
          <div>
            <span className="inline-flex rounded-full border border-jade-500/20 bg-white/70 px-3 py-1.5 text-xs font-medium text-jade-700 shadow-sm backdrop-blur">Konsultasi aman, privat, dan terarah</span>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-ink-900 sm:text-5xl lg:text-6xl">
              Ruang untuk bercerita, <span className="text-jade-600">dukungan untuk pulih.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-700/75 sm:text-lg sm:leading-8">
              Temui dokter kesehatan jiwa rumah sakit secara daring. Mulai dari skrining awal, lanjutkan konsultasi melalui chat, dan dapatkan arahan perawatan yang tersimpan rapi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="rounded-xl bg-jade-500 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-jade-500/15 transition hover:-translate-y-0.5 hover:bg-jade-600">Mulai Konsultasi</Link>
              <a href="#cara-kerja" className="rounded-xl border border-sage-200 bg-white px-6 py-3.5 text-center text-sm font-semibold text-ink-900 transition hover:border-jade-500">Lihat Cara Kerja</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-700/65">
              <span>✓ Data dilindungi</span><span>✓ Dokter rumah sakit</span><span>✓ Riwayat tersimpan</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-4 rotate-2 rounded-[2rem] bg-jade-500/10" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-ink-900/10 backdrop-blur sm:p-8">
              <div className="flex items-center gap-3 border-b border-sage-100 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-jade-500/10 text-sm font-semibold text-jade-700">Dr</div>
                <div><p className="text-sm font-semibold text-ink-900">Konsultasi privat</p><p className="text-xs text-ink-700/60">Terhubung dengan dokter Anda</p></div>
                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-jade-500" />
              </div>
              <div className="space-y-4 py-7">
                <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-sage-100 px-4 py-3 text-sm leading-6 text-ink-700">Apa yang paling mengganggu pikiran Anda akhir-akhir ini?</div>
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-jade-500 px-4 py-3 text-sm leading-6 text-white">Belakangan saya sulit tidur dan merasa cemas hampir setiap hari.</div>
                <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-sage-100 px-4 py-3 text-sm leading-6 text-ink-700">Terima kasih sudah bercerita. Mari kita pahami bersama pelan-pelan.</div>
              </div>
              <div className="rounded-xl bg-sage-50 px-4 py-3 text-xs text-ink-700/60">Percakapan hanya dapat diakses selama konsultasi aktif.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="bg-white py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-jade-700">Cara kerja</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-ink-900 sm:text-4xl">Satu alur yang jelas dari awal hingga tindak lanjut.</h2>
            <p className="mt-4 text-base leading-7 text-ink-700/70">Anda selalu dapat melihat status konsultasi dari dashboard pasien.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {consultationSteps.map(([number, title, description]) => (
              <article key={number} className="group rounded-2xl border border-sage-200 bg-sage-50/50 p-5 transition hover:-translate-y-1 hover:border-jade-500/40 hover:bg-white hover:shadow-lg hover:shadow-jade-500/5">
                <span className="text-sm font-semibold text-clay-500">{number}</span>
                <h3 className="mt-8 font-semibold text-ink-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-700/70">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-jade-700">Dokter kami</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-ink-900 sm:text-4xl">Ditangani oleh dokter rumah sakit.</h2>
            <p className="mt-4 text-base leading-7 text-ink-700/70">Dokter yang tersedia dapat mengambil konsultasi setelah pembayaran Anda diverifikasi.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctorsLoading && [0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-sage-200 bg-white/60" />)}
            {!doctorsLoading && doctors.map((doctor) => (
              <article key={doctor.id} className="rounded-2xl border border-sage-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-jade-500/10 text-base font-semibold text-jade-700">{getInitials(doctor.full_name)}</div>
                  <div><h3 className="font-semibold text-ink-900">{doctor.full_name}</h3><p className="mt-1 text-sm text-ink-700/65">{doctor.specialization || "Dokter Telemedicine Jiwa"}</p></div>
                </div>
                <div className="mt-6 flex items-center gap-2 border-t border-sage-100 pt-4 text-xs text-ink-700/60"><span className="h-2 w-2 rounded-full bg-jade-500" /> Terdaftar sebagai dokter aktif</div>
              </article>
            ))}
            {!doctorsLoading && doctors.length === 0 && <div className="rounded-2xl border border-sage-200 bg-white p-6 text-sm text-ink-700/70 sm:col-span-2 lg:col-span-3">Profil dokter sedang diperbarui. Anda tetap dapat memulai pendaftaran konsultasi.</div>}
          </div>
        </div>
      </section>

      <section className="bg-jade-700 py-16 text-white sm:py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl"><p className="text-sm font-medium text-sage-200">Tidak harus menghadapi semuanya sendiri.</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Mulai langkah pertama Anda hari ini.</h2><p className="mt-4 leading-7 text-white/70">Buat akun, selesaikan skrining awal, dan pantau seluruh proses dari dashboard Anda.</p></div>
          <Link href="/register" className="shrink-0 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-jade-700 transition hover:bg-sage-50">Daftar sebagai Pasien</Link>
        </div>
      </section>

      <footer className="bg-ink-900 py-10 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
          <div><p className="text-sm font-semibold">Telemedicine Jiwa</p><p className="mt-1 text-xs text-white/50">Layanan konsultasi kesehatan jiwa daring rumah sakit.</p></div>
          <p className="max-w-md text-xs leading-5 text-white/50">Layanan ini bukan layanan kegawatdaruratan. Dalam keadaan krisis atau bahaya langsung, segera hubungi layanan darurat atau IGD terdekat.</p>
        </div>
      </footer>
    </main>
  );
}

function getInitials(name: string) {
  return name.replace(/^(dr\.?|dokter)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DR";
}
