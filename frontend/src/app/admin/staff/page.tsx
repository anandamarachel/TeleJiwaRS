"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { AdminDoctorProfile } from "@/lib/types";

type StaffRole = "doctor" | "admin";
type StaffItem = {
  id: number; email: string; full_name: string; role: StaffRole; created_at: string;
  is_active: boolean; is_super_admin: boolean; doctor_id: number | null; license_number: string | null;
  specialization: string | null; photo_url: string | null;
};

export default function AdminStaffPage() {
  return <RequireAuth allowedRoles={["admin"]} requireSuperAdmin><StaffManagement /></RequireAuth>;
}

function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffItem[] | null>(null);
  const [role, setRole] = useState<StaffRole>("doctor");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<StaffItem[]>("/staff")
      .then(setStaff)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Daftar staf gagal dimuat."));
  }, []);

  async function refreshStaff() {
    setStaff(await apiFetch<StaffItem[]>("/staff"));
  }

  async function createStaff(event: FormEvent) {
    event.preventDefault();
    setError(null); setCreatedMessage(null);
    if (!fullName.trim() || !email.trim() || password.length < 8 || (role === "doctor" && !licenseNumber.trim())) {
      setError("Lengkapi seluruh kolom wajib. Kata sandi minimal 8 karakter."); return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/staff/create", { method: "POST", body: JSON.stringify({
        full_name: fullName.trim(), email: email.trim(), password, role,
        license_number: role === "doctor" ? licenseNumber.trim() : null,
        specialization: role === "doctor" ? specialization.trim() || null : null,
      }) });
      setCreatedMessage(`Akun ${role === "doctor" ? "dokter" : "administrator"} ${fullName.trim()} berhasil dibuat.`);
      setFullName(""); setEmail(""); setPassword(""); setLicenseNumber(""); setSpecialization("");
      await refreshStaff();
    } catch (err) { setError(err instanceof ApiError ? err.detail : "Akun staf gagal dibuat."); }
    finally { setSubmitting(false); }
  }

  function updateStaff(updated: StaffItem) {
    setStaff((items) => items?.map((item) => item.id === updated.id ? updated : item) ?? []);
  }
  function updateDoctorPhoto(userId: number, photoUrl: string | null) {
    setStaff((items) => items?.map((item) => item.id === userId ? { ...item, photo_url: photoUrl } : item) ?? []);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header><Link href="/admin/payments" className="text-sm font-medium text-jade-700 hover:underline">← Kembali ke pembayaran</Link><h1 className="mt-4 text-2xl font-semibold text-ink-900">Kelola Staf</h1><p className="mt-1 text-sm text-ink-700/70">Buat dan kelola akun administrator serta dokter rumah sakit.</p></header>
      {createdMessage && <p role="status" className="rounded-xl bg-jade-500/10 p-4 text-sm text-jade-700">{createdMessage}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={createStaff} className="space-y-4 rounded-2xl border border-sage-200 bg-white p-6 lg:sticky lg:top-6">
          <div><h2 className="font-semibold text-ink-900">Buat Akun Staf</h2><p className="mt-1 text-xs leading-5 text-ink-700/60">Tambahkan dokter atau administrator baru.</p></div>
          <Field label="Peran" id="role"><select id="role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}><option value="doctor">Dokter</option><option value="admin">Administrator</option></select></Field>
          <Field label="Nama lengkap *" id="full-name"><input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} /></Field>
          <Field label="Email *" id="email"><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} /></Field>
          <Field label="Kata sandi sementara *" id="password"><input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} /><p className="mt-1 text-xs text-ink-700/60">Minimal 8 karakter. Sampaikan melalui kanal internal yang aman.</p></Field>
          {role === "doctor" && <><Field label="Nomor izin praktik *" id="license"><input id="license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required className={inputClass} /></Field><Field label="Spesialisasi" id="specialization"><input id="specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputClass} /></Field></>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-jade-500 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-50">{submitting ? "Membuat akun..." : "Buat Akun Staf"}</button>
        </form>

        <section><div className="mb-4"><h2 className="font-semibold text-ink-900">Daftar Staf</h2><p className="mt-1 text-xs text-ink-700/60">Penghapusan akun menonaktifkan akses tanpa menghapus riwayat administrasi atau klinis.</p></div>
          {staff === null ? <StateCard text="Memuat daftar staf..." /> : staff.length === 0 ? <StateCard text="Belum ada akun staf." /> : <div className="space-y-4">{staff.map((item) => item.role === "doctor" ? <DoctorStaffCard key={item.id} staff={item} onUpdated={updateStaff} onPhotoUpdated={updateDoctorPhoto} onError={setError} /> : <AdminStaffCard key={item.id} staff={item} isCurrentUser={item.id === user?.id} onUpdated={updateStaff} onError={setError} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function AdminStaffCard({ staff, isCurrentUser, onUpdated, onError }: { staff: StaffItem; isCurrentUser: boolean; onUpdated: (staff: StaffItem) => void; onError: (message: string | null) => void }) {
  return <article className="rounded-2xl border border-sage-200 bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink-900">{staff.full_name}</h3><AdminTypeBadge isSuperAdmin={staff.is_super_admin} /><ActiveBadge active={staff.is_active} /></div><p className="mt-1 text-sm text-ink-700/60">{staff.email}{isCurrentUser ? " · Akun Anda" : ""}</p></div><AccessButton staff={staff} disabled={isCurrentUser} onUpdated={onUpdated} onError={onError} /></div></article>;
}

function DoctorStaffCard({ staff, onUpdated, onPhotoUpdated, onError }: { staff: StaffItem; onUpdated: (staff: StaffItem) => void; onPhotoUpdated: (userId: number, url: string | null) => void; onError: (message: string | null) => void }) {
  const [name, setName] = useState(staff.full_name);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"name" | "upload" | "photo-delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function saveName() { if (!name.trim()) return; setBusy("name"); setMessage(null); onError(null); try { const updated = await apiFetch<StaffItem>(`/staff/${staff.id}`, { method: "PATCH", body: JSON.stringify({ full_name: name.trim() }) }); onUpdated(updated); setName(updated.full_name); setMessage("Nama dokter diperbarui."); } catch (err) { onError(err instanceof ApiError ? err.detail : "Nama dokter gagal diperbarui."); } finally { setBusy(null); } }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) { const selected = event.target.files?.[0] ?? null; setMessage(null); if (selected && !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { onError("Foto harus berupa JPEG, PNG, atau WebP."); event.target.value = ""; return setFile(null); } if (selected && selected.size > 2 * 1024 * 1024) { onError("Ukuran foto maksimal 2 MB."); event.target.value = ""; return setFile(null); } onError(null); setFile(selected); }
  async function uploadPhoto() { if (!file || !staff.doctor_id) return; setBusy("upload"); setMessage(null); onError(null); const body = new FormData(); body.append("file", file); try { const updated = await apiFetch<AdminDoctorProfile>(`/doctors/manage/${staff.doctor_id}/photo`, { method: "POST", body }); onPhotoUpdated(staff.id, updated.photo_url); setFile(null); setMessage("Foto dokter disimpan."); } catch (err) { onError(err instanceof ApiError ? err.detail : "Foto dokter gagal disimpan."); } finally { setBusy(null); } }
  async function deletePhoto() { if (!staff.doctor_id || !window.confirm(`Hapus foto profil ${staff.full_name}?`)) return; setBusy("photo-delete"); setMessage(null); onError(null); try { await apiFetch<void>(`/doctors/manage/${staff.doctor_id}/photo`, { method: "DELETE" }); onPhotoUpdated(staff.id, null); setMessage("Foto dokter dihapus."); } catch (err) { onError(err instanceof ApiError ? err.detail : "Foto dokter gagal dihapus."); } finally { setBusy(null); } }
  return <article className="rounded-2xl border border-sage-200 bg-white p-5"><div className="flex flex-col gap-5 sm:flex-row"><div className="shrink-0">{staff.photo_url ? <Image src={staff.photo_url} alt={`Foto ${staff.full_name}`} width={96} height={96} className="h-24 w-24 rounded-2xl object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-jade-500/10 text-xl font-semibold text-jade-700">{getInitials(staff.full_name)}</div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><RoleBadge role="doctor" /><ActiveBadge active={staff.is_active} /></div><p className="mt-2 text-sm text-ink-700/60">{staff.email}</p><p className="mt-1 text-xs text-ink-700/50">SIP: {staff.license_number} · {staff.specialization || "Spesialisasi belum diisi"}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} aria-label={`Nama ${staff.full_name}`} className={inputClass} /><button onClick={saveName} disabled={busy !== null || !name.trim() || name.trim() === staff.full_name} className="shrink-0 rounded-lg border border-jade-500 px-3 py-2 text-xs font-medium text-jade-700 disabled:opacity-40">{busy === "name" ? "Menyimpan..." : "Simpan Nama"}</button></div><div className="mt-3"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={busy !== null} className="block w-full text-xs text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-jade-500/10 file:px-3 file:py-2 file:font-medium file:text-jade-700" />{file && <p className="mt-1 truncate text-xs text-ink-700/60">Dipilih: {file.name}</p>}<div className="mt-2 flex gap-2"><button onClick={uploadPhoto} disabled={!file || busy !== null} className="rounded-lg bg-jade-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-40">{busy === "upload" ? "Mengunggah..." : staff.photo_url ? "Ganti Foto" : "Unggah Foto"}</button>{staff.photo_url && <button onClick={deletePhoto} disabled={busy !== null} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-40">{busy === "photo-delete" ? "Menghapus..." : "Hapus Foto"}</button>}</div></div>{message && <p role="status" className="mt-2 text-xs text-jade-700">{message}</p>}<div className="mt-4 border-t border-sage-100 pt-4"><AccessButton staff={staff} onUpdated={onUpdated} onError={onError} /></div></div></div></article>;
}

function AccessButton({ staff, disabled = false, onUpdated, onError }: { staff: StaffItem; disabled?: boolean; onUpdated: (staff: StaffItem) => void; onError: (message: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  async function changeAccess() { const action = staff.is_active ? "menonaktifkan" : "mengaktifkan kembali"; if (!window.confirm(`Yakin ingin ${action} akses ${staff.full_name}?`)) return; setBusy(true); onError(null); try { onUpdated(await apiFetch<StaffItem>(staff.is_active ? `/staff/${staff.id}` : `/staff/${staff.id}/restore`, { method: staff.is_active ? "DELETE" : "POST" })); } catch (err) { onError(err instanceof ApiError ? err.detail : "Status akses staf gagal diperbarui."); } finally { setBusy(false); } }
  return <button onClick={changeAccess} disabled={disabled || busy} title={disabled ? "Anda tidak dapat menghapus akses akun sendiri" : undefined} className={`rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40 ${staff.is_active ? "border border-red-200 text-red-700" : "bg-jade-500 text-white"}`}>{busy ? "Memproses..." : staff.is_active ? "Hapus Akses" : "Aktifkan Kembali"}</button>;
}

function RoleBadge({ role }: { role: StaffRole }) { return <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">{role === "doctor" ? "Dokter" : "Administrator"}</span>; }
function AdminTypeBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) { return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isSuperAdmin ? "bg-clay-400/20 text-ink-900" : "bg-sage-100 text-ink-700"}`}>{isSuperAdmin ? "Admin Utama" : "Admin Operasional"}</span>; }
function ActiveBadge({ active }: { active: boolean }) { return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${active ? "bg-jade-500/10 text-jade-700" : "bg-red-50 text-red-700"}`}>{active ? "Aktif" : "Nonaktif"}</span>; }
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</label><div className="mt-1.5">{children}</div></div>; }
function StateCard({ text }: { text: string }) { return <p className="rounded-2xl border border-sage-200 bg-white p-10 text-center text-sm text-ink-700/65">{text}</p>; }
function getInitials(name: string) { return name.replace(/^(dr\.?|dokter)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DR"; }
const inputClass = "w-full rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500";
