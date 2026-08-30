"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

type PatientProfile = {
  id: number;
  email: string;
  full_name: string;
  phone_number: string;
  nik: string | null;
  created_at: string;
};

export default function ProfilePage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nik, setNik] = useState("");
  const [nikConfirmation, setNikConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PatientProfile>("/patients/me")
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name);
        setEmail(data.email);
        setEmailConfirmation(data.email);
        setPhoneNumber(data.phone_number);
        setNik(data.nik ?? "");
        setNikConfirmation(data.nik ?? "");
      })
      .catch((error) => {
        setSaveError(error instanceof ApiError ? error.detail : "Gagal memuat profil.");
      });
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{16}$/.test(nik)) {
      setSaved(false);
      setSaveError("NIK harus terdiri dari 16 digit angka.");
      return;
    }
    if (email.trim().toLowerCase() !== emailConfirmation.trim().toLowerCase()) {
      setSaved(false);
      setSaveError("Konfirmasi email tidak cocok.");
      return;
    }
    if (nik !== nikConfirmation) {
      setSaved(false);
      setSaveError("Konfirmasi NIK tidak cocok.");
      return;
    }
    const sensitiveChanged = profile !== null && (
      email.trim().toLowerCase() !== profile.email.toLowerCase() || nik !== (profile.nik ?? "")
    );
    if (sensitiveChanged && !currentPassword) {
      setSaved(false);
      setSaveError("Masukkan kata sandi saat ini untuk mengubah email atau NIK.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const updated = await apiFetch<PatientProfile>("/patients/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName,
          email,
          email_confirmation: emailConfirmation,
          phone_number: phoneNumber,
          nik,
          nik_confirmation: nikConfirmation,
          current_password: sensitiveChanged ? currentPassword : null,
        }),
      });
      setProfile(updated);
      setFullName(updated.full_name);
      setEmail(updated.email);
      setEmailConfirmation(updated.email);
      setPhoneNumber(updated.phone_number);
      setNik(updated.nik ?? "");
      setNikConfirmation(updated.nik ?? "");
      setCurrentPassword("");
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.detail : "Profil gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch<void>("/patients/me", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      clearSession();
      router.replace("/");
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.detail : "Akun gagal dihapus.");
      setDeleting(false);
    }
  }

  if (!profile && !saveError) return <StateMessage text="Memuat profil..." />;

  const emailChanged = profile !== null && email.trim().toLowerCase() !== profile.email.toLowerCase();
  const nikChanged = profile !== null && nik !== (profile.nik ?? "");
  const sensitiveChanged = emailChanged || nikChanged;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <Link href="/dashboard" className="text-sm font-medium text-jade-700 hover:underline">
          ← Kembali ke dashboard
        </Link>
        <h1 className="mt-5 text-2xl font-semibold text-ink-900">Profil Saya</h1>
        <p className="mt-1 text-sm text-ink-700/70">Perbarui identitas dan informasi kontak Anda.</p>
      </header>

      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-sage-200 bg-white p-6">
        <Field label="Nama lengkap" id="full-name">
          <input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={255} className={inputClass} />
        </Field>
        <Field label="Email" id="email">
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby="email-help" className={inputClass} />
          <p id="email-help" className="mt-1.5 text-xs leading-5 text-ink-700/60">
            Email baru akan digunakan untuk login setelah perubahan disimpan.
          </p>
        </Field>
        <Field label="Konfirmasi email" id="email-confirmation">
          <input id="email-confirmation" type="email" value={emailConfirmation} onChange={(e) => setEmailConfirmation(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Nomor WhatsApp" id="phone-number">
          <input id="phone-number" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required minLength={8} maxLength={20} aria-describedby="phone-number-help" className={inputClass} />
          <p id="phone-number-help" className="mt-1.5 text-xs leading-5 text-jade-700">
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
            onChange={(event) => setNik(event.target.value.replace(/\D/g, "").slice(0, 16))}
            required
            minLength={16}
            maxLength={16}
            pattern="[0-9]{16}"
            aria-describedby="nik-help"
            className={inputClass}
          />
          <p id="nik-help" className="mt-1.5 text-xs leading-5 text-ink-700/60">
            Pastikan 16 digit NIK sesuai dengan KTP untuk keperluan administrasi rumah sakit.
          </p>
        </Field>
        <Field label="Konfirmasi NIK" id="nik-confirmation">
          <input
            id="nik-confirmation"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={nikConfirmation}
            onChange={(event) => setNikConfirmation(event.target.value.replace(/\D/g, "").slice(0, 16))}
            required
            minLength={16}
            maxLength={16}
            pattern="[0-9]{16}"
            className={inputClass}
          />
        </Field>
        {sensitiveChanged && (
          <div className="rounded-xl border border-clay-400/40 bg-clay-400/10 p-4">
            <p className="text-sm font-medium text-ink-900">Konfirmasi perubahan data sensitif</p>
            <p className="mt-1 text-xs leading-5 text-ink-700/70">
              {nikChanged ? "NIK hanya dapat diubah sebelum Anda memiliki riwayat konsultasi. " : ""}
              Masukkan kata sandi saat ini untuk melanjutkan.
            </p>
            <label htmlFor="current-password" className="mt-3 block text-sm font-medium text-ink-900">Kata sandi saat ini</label>
            <input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" className={`mt-1.5 ${inputClass}`} />
          </div>
        )}
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {saved && <p role="status" className="text-sm text-jade-700">Profil berhasil diperbarui.</p>}
        <button disabled={saving} className="w-full rounded-lg bg-jade-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-60">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="font-semibold text-ink-900">Hapus akun</h2>
        <p className="mt-2 text-sm leading-6 text-ink-700/70">
          Akun dan data identitas Anda akan dinonaktifkan serta dianonimkan secara permanen. Riwayat klinis yang wajib disimpan rumah sakit tetap dipertahankan. Akun tidak dapat dihapus ketika konsultasi masih berjalan.
        </p>
        {!showDelete ? (
          <button type="button" onClick={() => setShowDelete(true)} className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            Hapus Akun Saya
          </button>
        ) : (
          <form onSubmit={deleteAccount} className="mt-5 space-y-4 rounded-xl bg-red-50 p-4">
            <Field label="Kata sandi saat ini" id="delete-password">
              <input id="delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputClass} />
            </Field>
            <Field label='Ketik "HAPUS AKUN" untuk konfirmasi' id="delete-confirmation">
              <input id="delete-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required className={inputClass} />
            </Field>
            {deleteError && <p role="alert" className="text-sm text-red-700">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowDelete(false); setDeleteError(null); }} disabled={deleting} className="flex-1 rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm font-medium">Batal</button>
              <button disabled={deleting || confirmation !== "HAPUS AKUN" || !password} className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
                {deleting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

const inputClass = "w-full rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</label><div className="mt-1.5">{children}</div></div>;
}

function StateMessage({ text }: { text: string }) {
  return <div className="flex min-h-full flex-1 items-center justify-center"><p className="text-sm text-ink-700/70">{text}</p></div>;
}
