import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Lock,
  Search,
} from 'lucide-react';
import { OfficerProfile } from '../types/vms';
import {
  confirmPasswordResetUrl,
  fetchOfficerDirectory,
  loginWithCredentials,
  requestPasswordResetUrl,
} from '../services/vmsService';
import { firebaseVerifyResetCode } from '../firebase';

interface LoginPageProps {
  onLoginSuccess: (officer: OfficerProfile) => void;
}

type LoginViewMode = 'SIGN_IN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [viewMode, setViewMode] = useState<LoginViewMode>('SIGN_IN');
  const [directory, setDirectory] = useState<OfficerProfile[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Forgot / Reset password states
  const [oobCode, setOobCode] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dropdownWrapperRef = useRef<HTMLDivElement>(null);

  // Load registered officers directory from server (works in Guest Mode)
  useEffect(() => {
    let active = true;
    fetchOfficerDirectory()
      .then((list) => {
        if (active) setDirectory(list);
      })
      .catch(() => {
        // Ignore if transient
      })
      .finally(() => {
        if (active) setDirectoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Detect Firebase password reset URL parameters (?mode=resetPassword&oobCode=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) {
      setOobCode(code);
      setViewMode('RESET_PASSWORD');
      firebaseVerifyResetCode(code)
        .then((verifiedEmail) => {
          setResetTargetEmail(verifiedEmail);
        })
        .catch(() => {
          setErrorMsg('Pautan tetapan semula kata laluan tidak sah atau telah tamat tempoh.');
        });
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownWrapperRef.current &&
        !dropdownWrapperRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredDirectory = useMemo(() => {
    const q = emailInput.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (item) =>
        item.email.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q) ||
        item.badgeNo.toLowerCase().includes(q) ||
        item.grade.toLowerCase().includes(q)
    );
  }, [emailInput, directory]);

  const handleSelectOfficer = (officer: OfficerProfile) => {
    setEmailInput(officer.email);
    setShowDropdown(false);
    setErrorMsg(null);
    setTimeout(() => passwordRef.current?.focus(), 20);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!emailInput.trim()) {
      setErrorMsg('Sila cari dan pilih alamat e-mel berdaftar.');
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setErrorMsg('Sila masukkan kata laluan anda.');
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const officer = await loginWithCredentials(emailInput.trim(), password);
      onLoginSuccess(officer);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Log masuk gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!emailInput.trim()) {
      setErrorMsg('Sila pilih atau masukkan e-mel berdaftar terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordResetUrl(emailInput.trim());
      setInfoMsg(res.message);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghantar URL tetapan semula kata laluan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('Kata laluan baru mestilah sekurang-kurangnya 6 aksara.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Pengesahan kata laluan baru tidak sepadan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmPasswordResetUrl({
        oobCode,
        newPassword,
        confirmPassword,
      });
      if (res.email) setEmailInput(res.email);
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, '', window.location.pathname);
      setViewMode('SIGN_IN');
      setInfoMsg(res.message);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menetapkan semula kata laluan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E9ECEF] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] bg-white rounded-[4px] border border-slate-200 shadow-sm border-t-[3px] border-t-[#007BFF]">
        {/* Header / Official Kastam Crest Section */}
        <div className="px-7 pt-7 pb-6 text-center border-b border-slate-200">
          <img
            src="/assets/aistudio/logo_kastam_0b236f05.svg"
            alt="Logo Rasmi Jabatan Kastam Diraja Malaysia"
            referrerPolicy="no-referrer"
            className="w-24 h-20 mx-auto object-contain select-none"
          />
          <h1 className="mt-4 text-[18px] sm:text-[19px] font-extrabold tracking-tight text-slate-900 uppercase leading-snug">
            VEHICLE MONITORING SYSTEM MANUAL (VMSM)
          </h1>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          {viewMode === 'SIGN_IN' && (
            <>
              <p className="text-sm text-slate-600 text-center mb-5">
                Sign in to start your session
              </p>

              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Searchable Email Dropdown */}
                <div ref={dropdownWrapperRef} className="relative">
                  <div className="flex items-stretch h-10 border border-slate-300 rounded-[4px] focus-within:border-[#007BFF] focus-within:ring-1 focus-within:ring-[#007BFF]/30 bg-white overflow-hidden">
                    <input
                      ref={emailRef}
                      type="text"
                      autoComplete="off"
                      value={emailInput}
                      onFocus={() => setShowDropdown(true)}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setShowDropdown(true);
                      }}
                      placeholder="Cari & pilih emel berdaftar..."
                      aria-label="Cari dan pilih e-mel berdaftar"
                      className="flex-1 min-w-0 px-3 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDropdown((prev) => !prev)}
                      aria-label="Buka senarai e-mel berdaftar"
                      className="w-10 shrink-0 flex items-center justify-center bg-slate-50 border-l border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showDropdown ? (
                        <ChevronDown className="w-4 h-4 rotate-180 transition-transform" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-300 rounded-[4px] shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {directoryLoading ? (
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">
                          Memuatkan senarai pegawai...
                        </div>
                      ) : filteredDirectory.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">
                          Tiada emel berdaftar sepadan ditemui.
                        </div>
                      ) : (
                        filteredDirectory.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectOfficer(item)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono font-semibold text-blue-900 truncate">
                                {item.email}
                              </span>
                              {item.badgeNo && (
                                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                  No. {item.badgeNo}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                              {item.fullName}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Password Input */}
                <div className="flex items-stretch h-10 border border-slate-300 rounded-[4px] focus-within:border-[#007BFF] focus-within:ring-1 focus-within:ring-[#007BFF]/30 bg-white overflow-hidden">
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Kata laluan"
                    className="flex-1 min-w-0 px-3 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata laluan' : 'Tunjuk kata laluan'}
                    className="w-10 shrink-0 flex items-center justify-center bg-slate-50 border-l border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-[4px] text-xs text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {infoMsg && (
                  <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-[4px] text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{infoMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setViewMode('FORGOT_PASSWORD');
                    }}
                    className="text-[13px] font-medium text-[#007BFF] hover:underline cursor-pointer"
                  >
                    Lupa kata laluan?
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 text-sm font-medium text-white bg-[#007BFF] hover:bg-[#0069D9] disabled:opacity-50 rounded-[4px] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isSubmitting ? 'Signing In...' : 'Sign In'}
                  </button>
                </div>
              </form>
            </>
          )}

          {viewMode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleSendResetUrl} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-base font-bold text-slate-900">Lupa Kata Laluan</h2>
                <p className="text-xs text-slate-500">
                  Masukkan e-mel berdaftar anda. Firebase akan menghantar URL tetapan semula kata laluan ke peti masuk anda.
                </p>
              </div>

              <div className="flex items-stretch h-10 border border-slate-300 rounded-[4px] focus-within:border-[#007BFF] bg-white overflow-hidden">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nama@customs.gov.my"
                  className="flex-1 min-w-0 px-3 text-sm text-slate-900 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-[4px] text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-[4px] text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setViewMode('SIGN_IN');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Log Masuk</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#007BFF] hover:bg-[#0069D9] disabled:opacity-50 rounded-[4px] cursor-pointer"
                >
                  {isSubmitting ? 'Menghantar...' : 'Hantar URL Reset'}
                </button>
              </div>
            </form>
          )}

          {viewMode === 'RESET_PASSWORD' && (
            <form onSubmit={handleConfirmResetSubmit} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-base font-bold text-slate-900">Tetapkan Kata Laluan Baru</h2>
                {resetTargetEmail && (
                  <p className="text-xs font-mono text-blue-900">{resetTargetEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Laluan Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 aksara"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-[4px] focus:border-[#007BFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sahkan Kata Laluan Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Taip semula kata laluan baru"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-[4px] focus:border-[#007BFF] focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-[4px] text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    window.history.replaceState({}, '', window.location.pathname);
                    setViewMode('SIGN_IN');
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#007BFF] hover:bg-[#0069D9] disabled:opacity-50 rounded-[4px] cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Kata Laluan Baru'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Exact Requested Footer */}
      <p className="mt-6 text-center text-xs text-slate-600">
        © 2026 Jabatan Kastam Diraja Malaysia · ICQS Sungai Tujuh, Miri
      </p>
    </div>
  );
};
