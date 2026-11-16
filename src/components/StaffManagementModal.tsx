import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { OfficerProfile, OfficerRole } from '../types/vms';
import {
  adminResetOfficerPassword,
  createOfficerAccount,
  deleteOfficerAccount,
  fetchAllOfficers,
  syncAllOfficersToFirebase,
  updateOfficerAccount,
} from '../services/vmsService';

interface StaffManagementModalProps {
  onClose: () => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  onClose,
}) => {
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // Add / Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('PEMBANTU PENGUASA KASTAM WK1');
  const [badgeNo, setBadgeNo] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OfficerRole>('PEGAWAI');
  const [initialPassword, setInitialPassword] = useState('123456');
  const [isSaving, setIsSaving] = useState(false);

  // Reset password inline dialog state
  const [resetTarget, setResetTarget] = useState<OfficerProfile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('123456');
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const loadOfficers = async () => {
    setLoading(true);
    try {
      const list = await fetchAllOfficers();
      setOfficers(list);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuatkan data pegawai.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOfficers();
  }, []);

  const filteredOfficers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return officers;
    return officers.filter(
      (o) =>
        o.fullName.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.grade.toLowerCase().includes(q) ||
        o.badgeNo.toLowerCase().includes(q)
    );
  }, [officers, search]);

  const openAddForm = () => {
    setEditingId(null);
    setFullName('');
    setGrade('PEMBANTU PENGUASA KASTAM WK1');
    setBadgeNo('');
    setEmail('');
    setRole('PEGAWAI');
    setInitialPassword('123456');
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (officer: OfficerProfile) => {
    setEditingId(officer.id);
    setFullName(officer.fullName);
    setGrade(officer.grade);
    setBadgeNo(officer.badgeNo);
    setEmail(officer.email);
    setRole(officer.role);
    setShowForm(true);
    setFeedback(null);
  };

  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateOfficerAccount(editingId, {
          fullName,
          grade,
          badgeNo,
          email,
          role,
        });
        setFeedback({ type: 'success', text: `Data pegawai ${fullName.toUpperCase()} berjaya dikemas kini.` });
      } else {
        await createOfficerAccount({
          fullName,
          grade,
          badgeNo,
          email,
          role,
          password: initialPassword || '123456',
        });
        setFeedback({
          type: 'success',
          text: `Pegawai baharu ${fullName.toUpperCase()} berjaya ditambah (kata laluan: ${initialPassword || '123456'}).`,
        });
      }
      setShowForm(false);
      await loadOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data pegawai.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOfficer = async (officer: OfficerProfile) => {
    setFeedback(null);
    try {
      await deleteOfficerAccount(officer.id);
      setFeedback({ type: 'success', text: `Rekod pegawai ${officer.fullName} telah dipadam.` });
      await loadOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memadam rekod pegawai.',
      });
    }
  };

  const handleConfirmAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setFeedback(null);
    setIsSaving(true);
    try {
      await adminResetOfficerPassword(resetTarget.id, resetPasswordValue, true);
      setFeedback({
        type: 'success',
        text: `Kata laluan bagi ${resetTarget.fullName} telah ditetapkan kepada "${resetPasswordValue}". Kata laluan lama tidak lagi boleh digunakan.`,
      });
      setResetTarget(null);
      await loadOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menetapkan semula kata laluan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncAllToFirebase = async () => {
    setIsSyncingFirebase(true);
    setFeedback(null);
    try {
      const res = await syncAllOfficersToFirebase();
      if (res.disabledInConsole) {
        setFeedback({
          type: 'warning',
          text: 'Penyedia Email/Password belum diaktifkan di Firebase Console (Authentication > Sign-in method > Email/Password). Aktifkan terlebih dahulu di projek gen-lang-client-0005045600, kemudian tekan butang Segerak ke Firebase semula.',
        });
      } else {
        setFeedback({
          type: 'success',
          text: `Penyegerakan Firebase selesai: ${res.createdCount} akaun baharu dicipta, ${res.existsCount} akaun sedia ada disahkan (Jumlah: ${res.total}).`,
        });
      }
      await loadOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyegerakkan ke Firebase.',
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-mgmt-title"
    >
      <div className="w-full max-w-5xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#072B7A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#FACC15]" />
            <div>
              <h2 id="staff-mgmt-title" className="text-base font-bold">
                Pengurusan Data Pegawai &amp; Pengguna VMSM
              </h2>
              <p className="text-[11px] text-blue-200">
                Tambah, sunting maklumat pegawai, set semula kata laluan, dan segerak ke Firebase Auth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, no. badan, gred atau emel..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncingFirebase}
              onClick={() => void handleSyncAllToFirebase()}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'Menyegerak...' : 'Segerak ke Firebase'}</span>
            </button>

            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Pegawai</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {feedback && (
            <div
              className={`flex items-start gap-2.5 p-3 rounded-lg text-xs border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Add / Edit Form */}
          {showForm && (
            <form
              onSubmit={handleSaveOfficer}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {editingId ? 'Sunting Data Pegawai' : 'Tambah Pegawai Baharu'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Penuh
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="cth. AHMAD BIN ALI"
                    className="w-full h-9 px-2.5 text-xs uppercase bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gred Penjawatan
                  </label>
                  <input
                    type="text"
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="cth. PEMBANTU PENGUASA KASTAM WK1"
                    className="w-full h-9 px-2.5 text-xs uppercase bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. Badan (Jika Ada)
                  </label>
                  <input
                    type="text"
                    value={badgeNo}
                    onChange={(e) => setBadgeNo(e.target.value)}
                    placeholder="cth. 19396"
                    className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emel Rasmi
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@customs.gov.my"
                    className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peranan Sistem
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as OfficerRole)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                  >
                    <option value="PEGAWAI">PEGAWAI</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kata Laluan Awal
                    </label>
                    <input
                      type="text"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#072B7A] hover:bg-blue-800 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : editingId ? 'Kemas Kini Pegawai' : 'Simpan Pegawai'}
                </button>
              </div>
            </form>
          )}

          {/* Admin Password Reset Inline Box */}
          {resetTarget && (
            <form
              onSubmit={handleConfirmAdminReset}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="text-xs font-bold text-amber-950">
                  Set Semula Kata Laluan: {resetTarget.fullName} ({resetTarget.email})
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Kata laluan baru (min. 6 aksara)"
                    className="h-9 px-3 text-xs font-mono bg-white border border-amber-300 rounded-lg focus:outline-none w-56"
                  />
                  <span className="text-[11px] text-amber-800">
                    Kata laluan lama akan diganti serta-merta.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="h-9 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  Sahkan Reset
                </button>
              </div>
            </form>
          )}

          {/* Officers Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 pl-4 pr-2 w-12">Bil</th>
                    <th className="py-2.5 px-2">Nama Penuh</th>
                    <th className="py-2.5 px-2">Gred Penjawatan</th>
                    <th className="py-2.5 px-2">No. Badan</th>
                    <th className="py-2.5 px-2">Emel Rasmi</th>
                    <th className="py-2.5 px-2">Peranan</th>
                    <th className="py-2.5 pl-2 pr-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        Memuatkan senarai pegawai...
                      </td>
                    </tr>
                  ) : filteredOfficers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        Tiada rekod pegawai sepadan ditemui.
                      </td>
                    </tr>
                  ) : (
                    filteredOfficers.map((officer, index) => (
                      <tr
                        key={officer.id}
                        className="border-b border-slate-100 hover:bg-slate-50/70 text-xs"
                      >
                        <td className="py-2.5 pl-4 pr-2 font-mono tabular-nums text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-900">
                          {officer.fullName}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600">{officer.grade}</td>
                        <td className="py-2.5 px-2 font-mono tabular-nums text-slate-700">
                          {officer.badgeNo || '—'}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-blue-900">
                          {officer.email}
                        </td>
                        <td className="py-2.5 px-2 font-semibold">
                          <span
                            className={
                              officer.role === 'ADMIN'
                                ? 'text-violet-700'
                                : 'text-slate-600'
                            }
                          >
                            {officer.role}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(officer)}
                              title="Sunting pegawai"
                              className="p-1.5 text-slate-500 hover:text-blue-800 hover:bg-blue-50 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(officer);
                                setResetPasswordValue('123456');
                              }}
                              title="Set semula kata laluan"
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {officer.email !== 'admin.apps.kastam@gmail.com' && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteOfficer(officer)}
                                title="Padam pegawai"
                                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
