import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, X } from 'lucide-react';
import { changeOwnPassword } from '../services/vmsService';
import { firebaseUpdatePassword } from '../firebase';

interface ChangePasswordModalProps {
  officerName: string;
  officerEmail: string;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  officerName,
  officerEmail,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Sila isi semua medan kata laluan.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Kata laluan baru mestilah sekurang-kurangnya 6 aksara.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Pengesahan kata laluan baru tidak sepadan.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await changeOwnPassword({
        oldPassword,
        newPassword,
        confirmPassword,
      });

      // Also update client Firebase session if active
      try {
        await firebaseUpdatePassword(oldPassword, newPassword);
      } catch {
        // Handled server-side if Firebase Email/Password is enabled
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg(
        res.firebaseUpdated
          ? 'Kata laluan berjaya dikemas kini di sistem VMSM dan Firebase. Kata laluan lama tidak lagi sah.'
          : 'Kata laluan berjaya dikemas kini di sistem VMSM. Kata laluan lama tidak lagi sah.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menukar kata laluan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pw-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 bg-[#072B7A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-[#FACC15]" />
            <h2 id="change-pw-title" className="text-sm font-bold">
              Tukar Kata Laluan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1 text-slate-300 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="font-semibold text-slate-900">{officerName}</div>
            <div className="font-mono text-slate-500 mt-0.5">{officerEmail}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kata Laluan Lama (Old Password)
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Masukkan kata laluan semasa"
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kata Laluan Baru (New Password)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 aksara"
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sahkan Kata Laluan Baru (Confirm Password)
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Taip semula kata laluan baru"
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:border-blue-800 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#072B7A] hover:bg-blue-800 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kata Laluan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
