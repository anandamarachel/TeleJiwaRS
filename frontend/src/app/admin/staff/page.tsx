"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ApiError } from "@/lib/api";

type StaffRole = "doctor" | "admin";
type CreatedStaff = { id: number; email: string; full_name: string; role: StaffRole; created_at: string };

export default function AdminStaffPage() {
  return <RequireAuth allowedRoles={["admin"]}><StaffForm /></RequireAuth>;
}

function StaffForm() {
  const [role, setRole] = useState<StaffRole>("doctor");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreated(null);
    if (!fullName.trim() || !email.trim() || password.length < 8 || (role === "doctor" && !licenseNumber.trim())) {
      setError("Lengkapi seluruh kolom wajib. Kata sandi minimal 8 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<CreatedStaff>("/staff/create", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(), email: email.trim(), password, role,
          license_number: role === "doctor" ? licenseNumber.trim() : null,
          specialization: role === "doctor" ? specialization.trim() || null : null,
        }),
      });
      setCreated(result);
      setFullName(""); setEmail(""); setPassword(""); setLicenseNumber(""); setSpecialization("");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Akun staf gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <Link href="/admin/payments" className="text-sm font-medium text-jade-700 hover:underline">← Kembali ke pembayaran</Link>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">Buat Akun Staf</h1>
        <p className="text-sm text-ink-700/70">Tambahkan akun dokter atau administrator rumah sakit.</p>
      </header>

      {created && <div className="rounded-xl bg-jade-500/10 p-4 text-sm text-ink-900"><p className="font-medium">Akun berhasil dibuat</p><p className="mt-1">{created.full_name} · {created.email}</p></div>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-sage-200 bg-white p-6">
        <Field label="Peran" id="role"><select id="role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}><option value="doctor">Dokter</option><option value="admin">Administrator</option></select></Field>
        <Field label="Nama lengkap *" id="full-name"><input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} /></Field>
        <Field label="Email *" id="email"><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
        <Field label="Kata sandi sementara *" id="password"><input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} /><p className="mt-1 text-xs text-ink-700/60">Minimal 8 karakter. Sampaikan melalui kanal internal yang aman.</p></Field>
        {role === "doctor" && <><Field label="Nomor izin praktik *" id="license"><input id="license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputClass} /></Field><Field label="Spesialisasi" id="specialization"><input id="specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputClass} /></Field></>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-jade-500 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-50">{submitting ? "Membuat akun..." : "Buat Akun Staf"}</button>
      </form>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</label><div className="mt-1.5">{children}</div></div>; }
const inputClass = "w-full rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500";
