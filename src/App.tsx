import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, LogOut, Users } from 'lucide-react';
import { OfficerProfile, VehicleLogRecord } from './types/vms';
import {
  fetchAllVehicleLogs,
  fetchCurrentSession,
  logoutSession,
} from './services/vmsService';
import { pairVehicleLogs } from './utils/plateParser';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './components/LoginPage';
import { VmsCounterPage } from './components/VmsCounterPage';
import { VmsDashboardPage } from './components/VmsDashboardPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { StaffManagementModal } from './components/StaffManagementModal';

type ActiveTab = 'VMS_IN' | 'VMS_OUT' | 'VMS_DASHBOARD';

function formatMalaysiaClock(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month').toUpperCase();
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const dayPeriod = get('dayPeriod').toUpperCase();

  return `${day} ${month} ${year} · ${hour}:${minute}:${second} ${dayPeriod} (Waktu Malaysia)`;
}

export default function App() {
  const [officer, setOfficer] = useState<OfficerProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('VMS_IN');
  const [logs, setLogs] = useState<VehicleLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [clockText, setClockText] = useState(() => formatMalaysiaClock(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(formatMalaysiaClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Restore session if token/cookie exists (works in Guest Mode via Bearer token or HttpOnly cookie)
  useEffect(() => {
    let active = true;
    fetchCurrentSession()
      .then((current) => {
        if (active) setOfficer(current);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLogsLoading(true);
    try {
      const list = await fetchAllVehicleLogs();
      setLogs(list);
      setSyncError(null);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Gagal memuatkan rekod kenderaan.'
      );
    } finally {
      if (showSpinner) setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!officer) {
      setLogs([]);
      return;
    }
    void refreshLogs(true);
    const interval = setInterval(() => {
      void refreshLogs(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [officer, refreshLogs]);

  const activeInsideCount = useMemo(() => {
    const trips = pairVehicleLogs(logs);
    return trips.filter((t) => t.status === 'DI_DALAM').length;
  }, [logs]);

  const handleLogout = async () => {
    await logoutSession();
    setOfficer(null);
    setLogs([]);
    setShowChangePassword(false);
    setShowStaffModal(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#E9ECEF] flex items-center justify-center p-6 text-sm text-slate-600">
        Memuatkan sistem VMSM...
      </div>
    );
  }

  if (!officer) {
    return (
      <ErrorBoundary>
        <LoginPage onLoginSuccess={(loggedOfficer) => setOfficer(loggedOfficer)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col">
        {/* Deep Royal Navy Header matching Image 3 */}
        <header className="bg-[#072B7A] text-white sticky top-0 z-30 shadow-sm no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left Brand + Crest + Malaysian Clock */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center shadow-xs">
                <img
                  src="/assets/aistudio/logo_kastam_0b236f05.svg"
                  alt="Logo Jabatan Kastam Diraja Malaysia"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold tracking-wide text-[#FACC15] uppercase truncate">
                  JABATAN KASTAM DIRAJA MALAYSIA
                </div>
                <div className="text-xs text-blue-100 font-medium truncate">
                  VEHICLE MONITORING SYSTEM MANUAL (VMSM) · ICQS Sungai Tujuh, Miri, Sarawak
                </div>
                <div className="text-[11px] font-mono tabular-nums text-blue-200/90 mt-0.5 truncate">
                  {clockText}
                </div>
              </div>
            </div>

            {/* Right Action Cluster matching Image 3 */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {officer.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setShowStaffModal(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Data Pegawai</span>
                </button>
              )}

              <div
                className="inline-flex items-center h-8 px-3 text-xs font-semibold text-white bg-[#103A96] border border-blue-400/30 rounded-lg whitespace-nowrap shrink-0 max-w-[240px] truncate"
                title={`${officer.fullName} (${officer.email})`}
              >
                {officer.role === 'ADMIN' ? 'ADMIN VMSM (ADMIN)' : officer.fullName}
              </div>

              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                title="Tukar Kata Laluan"
                aria-label="Tukar Kata Laluan"
                className="w-8 h-8 inline-flex items-center justify-center text-[#FACC15] bg-[#103A96] hover:bg-blue-700 border border-blue-400/30 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                title="Log Keluar"
                aria-label="Log Keluar"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-blue-100 hover:text-white bg-[#103A96] hover:bg-blue-700 border border-blue-400/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Keluar</span>
              </button>
            </div>
          </div>

          {/* Second Row: 3 Main Navigation Tabs inside Navy Header */}
          <div className="border-t border-blue-800/70">
            <nav
              aria-label="Navigasi utama"
              className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-6 sm:gap-8 overflow-x-auto"
            >
              <button
                type="button"
                onClick={() => setActiveTab('VMS_IN')}
                className={`py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'VMS_IN'
                    ? 'border-[#FACC15] text-[#FACC15]'
                    : 'border-transparent text-blue-100 hover:text-white'
                }`}
              >
                VMS IN
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('VMS_OUT')}
                className={`py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'VMS_OUT'
                    ? 'border-[#FACC15] text-[#FACC15]'
                    : 'border-transparent text-blue-100 hover:text-white'
                }`}
              >
                VMS OUT
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('VMS_DASHBOARD')}
                className={`py-2.5 inline-flex items-center gap-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'VMS_DASHBOARD'
                    ? 'border-[#FACC15] text-[#FACC15]'
                    : 'border-transparent text-blue-100 hover:text-white'
                }`}
              >
                <span>VMS Dashboard</span>
                {activeInsideCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums bg-[#FACC15] text-[#072B7A] rounded-sm leading-none">
                    {activeInsideCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          <div className="space-y-4">
            {syncError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-mono">
                Ralat penyegerakan rekod: {syncError}
              </div>
            )}

            {activeTab === 'VMS_IN' && (
              <VmsCounterPage
                direction="IN"
                officer={officer}
                allLogs={logs}
                isLoading={logsLoading}
                onLogsChanged={() => void refreshLogs(false)}
              />
            )}

            {activeTab === 'VMS_OUT' && (
              <VmsCounterPage
                direction="OUT"
                officer={officer}
                allLogs={logs}
                isLoading={logsLoading}
                onLogsChanged={() => void refreshLogs(false)}
              />
            )}

            {activeTab === 'VMS_DASHBOARD' && (
              <VmsDashboardPage allLogs={logs} isLoading={logsLoading} />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 no-print">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>© 2026 Jabatan Kastam Diraja Malaysia · ICQS Sungai Tujuh, Miri</span>
            <span>
              Pegawai bertugas: <strong className="text-slate-700">{officer.fullName}</strong> ({officer.email})
            </span>
          </div>
        </footer>

        {/* Modals */}
        {showChangePassword && (
          <ChangePasswordModal
            officerName={officer.fullName}
            officerEmail={officer.email}
            onClose={() => setShowChangePassword(false)}
          />
        )}

        {showStaffModal && officer.role === 'ADMIN' && (
          <StaffManagementModal onClose={() => setShowStaffModal(false)} />
        )}
      </div>
    </ErrorBoundary>
  );
}
