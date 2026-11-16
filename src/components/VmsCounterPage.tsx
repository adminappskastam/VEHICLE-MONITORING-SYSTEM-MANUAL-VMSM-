import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Search,
  Trash2,
} from 'lucide-react';
import {
  BOOTH_IN_LIST,
  BOOTH_OUT_LIST,
  BoothNo,
  Direction,
  OfficerProfile,
  VehicleLogRecord,
} from '../types/vms';
import {
  createVehicleLog,
  deleteVehicleLog,
  updateVehicleLog,
} from '../services/vmsService';
import {
  findRecentDuplicateLog,
  formatTimeOnly,
  fromDateTimeLocalValue,
  getEffectiveTimeMs,
  parsePlateInput,
  toDateTimeLocalValue,
  toLocalDateKey,
} from '../utils/plateParser';

interface VmsCounterPageProps {
  direction: Direction;
  officer: OfficerProfile;
  allLogs: VehicleLogRecord[];
  isLoading: boolean;
  onLogsChanged: () => void;
}

interface FeedbackBanner {
  type: 'success' | 'duplicate' | 'error';
  message: string;
}

interface InlineLogRowProps {
  record: VehicleLogRecord;
  boothOptions: BoothNo[];
  onSave: (
    logId: string,
    updates: {
      boothNo?: BoothNo;
      plateNo?: string;
      notes?: string;
      eventTimestamp?: string;
    }
  ) => Promise<void>;
  onDelete: (logId: string) => Promise<void>;
}

const InlineLogRow: React.FC<InlineLogRowProps> = ({
  record,
  boothOptions,
  onSave,
  onDelete,
}) => {
  const [plate, setPlate] = useState(record.plateNo);
  const [notes, setNotes] = useState(record.notes);
  const [booth, setBooth] = useState<BoothNo>(record.boothNo);
  const [localDt, setLocalDt] = useState(() => toDateTimeLocalValue(record.eventTimestamp));
  const [isDeleting, setIsDeleting] = useState(false);

  const plateFocused = useRef(false);
  const notesFocused = useRef(false);
  const dtFocused = useRef(false);

  useEffect(() => {
    if (!plateFocused.current) setPlate(record.plateNo);
  }, [record.plateNo]);

  useEffect(() => {
    if (!notesFocused.current) setNotes(record.notes);
  }, [record.notes]);

  useEffect(() => {
    setBooth(record.boothNo);
  }, [record.boothNo]);

  useEffect(() => {
    if (!dtFocused.current) setLocalDt(toDateTimeLocalValue(record.eventTimestamp));
  }, [record.eventTimestamp]);

  const commitPlate = async () => {
    const trimmed = plate.trim().toUpperCase().slice(0, 64);
    if (!trimmed) {
      setPlate(record.plateNo);
      return;
    }
    if (trimmed !== record.plateNo) {
      await onSave(record.id, { plateNo: trimmed });
    }
  };

  const commitNotes = async () => {
    const trimmed = notes.trim().slice(0, 200);
    if (trimmed !== record.notes) {
      await onSave(record.id, { notes: trimmed });
    }
  };

  const commitTimestamp = async (nextVal: string) => {
    const iso = fromDateTimeLocalValue(nextVal);
    if (!iso) {
      setLocalDt(toDateTimeLocalValue(record.eventTimestamp));
      return;
    }
    if (iso !== record.eventTimestamp) {
      await onSave(record.id, { eventTimestamp: iso });
    }
  };

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await onDelete(record.id);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <tr className="group border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="py-1.5 pl-4 pr-2 w-32">
        <select
          aria-label={`Booth bagi ${record.plateNo}`}
          value={booth}
          onChange={(e) => {
            const nextBooth = e.target.value as BoothNo;
            setBooth(nextBooth);
            void onSave(record.id, { boothNo: nextBooth });
          }}
          className="w-full h-9 px-2.5 text-xs font-mono font-medium tabular-nums bg-transparent border border-transparent rounded-md hover:border-slate-200 focus:border-[#072B7A] focus:bg-white focus:outline-none transition-colors cursor-pointer"
        >
          {boothOptions.map((b) => (
            <option key={b} value={b}>
              Booth {b}
            </option>
          ))}
        </select>
      </td>

      <td className="py-1.5 px-2 min-w-[160px]">
        <input
          type="text"
          aria-label={`Nombor plat ${record.plateNo}`}
          value={plate}
          maxLength={64}
          onFocus={() => {
            plateFocused.current = true;
          }}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          onBlur={() => {
            plateFocused.current = false;
            void commitPlate();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-full h-9 px-2.5 text-sm font-mono font-semibold tracking-wide text-slate-900 bg-transparent border border-transparent rounded-md hover:border-slate-200 focus:border-[#072B7A] focus:bg-white focus:outline-none transition-colors"
        />
      </td>

      <td className="py-1.5 px-2 w-52">
        <input
          type="datetime-local"
          step="1"
          aria-label={`Tarikh dan masa bagi ${record.plateNo}`}
          value={localDt}
          onFocus={() => {
            dtFocused.current = true;
          }}
          onChange={(e) => {
            setLocalDt(e.target.value);
          }}
          onBlur={(e) => {
            dtFocused.current = false;
            void commitTimestamp(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-full h-9 px-2.5 text-xs font-mono tabular-nums text-slate-700 bg-transparent border border-transparent rounded-md hover:border-slate-200 focus:border-[#072B7A] focus:bg-white focus:outline-none transition-colors"
        />
      </td>

      <td className="py-1.5 px-2 min-w-[170px]">
        <input
          type="text"
          aria-label={`Catatan bagi ${record.plateNo}`}
          value={notes}
          maxLength={200}
          placeholder="Tiada catatan"
          onFocus={() => {
            notesFocused.current = true;
          }}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            notesFocused.current = false;
            void commitNotes();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-full h-9 px-2.5 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent border border-transparent rounded-md hover:border-slate-200 focus:border-[#072B7A] focus:bg-white focus:outline-none transition-colors"
        />
      </td>

      <td className="py-1.5 px-2 min-w-[180px] text-xs font-medium text-slate-700">
        {record.officerName || record.createdByEmail || '—'}
      </td>

      <td className="py-1.5 pl-2 pr-4 w-24 text-right">
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDeleteClick()}
          title="Padam rekod ini"
          className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-medium text-red-700 bg-red-50/70 hover:bg-red-100 rounded-md transition-colors disabled:opacity-40 whitespace-nowrap cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Padam</span>
        </button>
      </td>
    </tr>
  );
};

export const VmsCounterPage: React.FC<VmsCounterPageProps> = ({
  direction,
  officer,
  allLogs,
  isLoading,
  onLogsChanged,
}) => {
  const isIncoming = direction === 'IN';
  const boothOptions: BoothNo[] = isIncoming ? BOOTH_IN_LIST : BOOTH_OUT_LIST;

  const [selectedBooth, setSelectedBooth] = useState<BoothNo>(
    isIncoming ? '5' : '1'
  );
  const [rawInput, setRawInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [boothFilter, setBoothFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const recentSubmitGuardRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setSelectedBooth(isIncoming ? '5' : '1');
    setBoothFilter('ALL');
    setSearchQuery('');
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [isIncoming]);

  const directionLogs = useMemo(() => {
    return allLogs.filter((l) => l.direction === direction);
  }, [allLogs, direction]);

  const todayKey = toLocalDateKey(Date.now());
  const todayCount = useMemo(() => {
    return directionLogs.filter(
      (l) => toLocalDateKey(getEffectiveTimeMs(l)) === todayKey
    ).length;
  }, [directionLogs, todayKey]);

  const selectedBoothTodayCount = useMemo(() => {
    return directionLogs.filter(
      (l) =>
        l.boothNo === selectedBooth &&
        toLocalDateKey(getEffectiveTimeMs(l)) === todayKey
    ).length;
  }, [directionLogs, selectedBooth, todayKey]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return directionLogs.filter((l) => {
      if (boothFilter !== 'ALL' && l.boothNo !== boothFilter) {
        return false;
      }
      if (q) {
        const matchPlate = l.plateNo.toUpperCase().includes(q);
        const matchNotes = l.notes.toUpperCase().includes(q);
        const matchOfficer = (l.officerName || '').toUpperCase().includes(q);
        if (!matchPlate && !matchNotes && !matchOfficer) return false;
      }
      return true;
    });
  }, [directionLogs, boothFilter, searchQuery]);

  const livePreview = useMemo(() => parsePlateInput(rawInput), [rawInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePlateInput(rawInput);
    if (!parsed) {
      inputRef.current?.focus();
      return;
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const normalizedPlate = parsed.plateNo.trim().toUpperCase();

    const lastLocalMs = recentSubmitGuardRef.current.get(normalizedPlate);
    const localDuplicate =
      lastLocalMs !== undefined && nowMs - lastLocalMs <= 5 * 60 * 1000;
    const existingDuplicate = findRecentDuplicateLog(
      directionLogs,
      normalizedPlate,
      nowMs
    );

    if (localDuplicate || existingDuplicate) {
      const existingTimeStr = existingDuplicate
        ? formatTimeOnly(existingDuplicate.eventTimestamp)
        : formatTimeOnly(new Date(lastLocalMs!).toISOString());
      const existingBoothStr = existingDuplicate
        ? `Booth ${existingDuplicate.boothNo}`
        : `Booth ${selectedBooth}`;

      setFeedback({
        type: 'duplicate',
        message: `Pendua dalam 5 minit dihapuskan automatik: ${normalizedPlate} telah direkodkan pada ${existingTimeStr} (${existingBoothStr}).`,
      });
      setRawInput('');
      inputRef.current?.focus();
      return;
    }

    recentSubmitGuardRef.current.set(normalizedPlate, nowMs);
    setIsSubmitting(true);
    setRawInput('');

    try {
      await createVehicleLog({
        direction,
        boothNo: selectedBooth,
        plateNo: normalizedPlate,
        notes: parsed.notes,
        eventTimestamp: nowIso,
      });

      setFeedback({
        type: 'success',
        message: parsed.notes
          ? `Direkodkan ${isIncoming ? 'MASUK' : 'KELUAR'}: ${normalizedPlate} · Catatan: ${parsed.notes} · Booth ${selectedBooth} · Pegawai: ${officer.fullName}`
          : `Direkodkan ${isIncoming ? 'MASUK' : 'KELUAR'}: ${normalizedPlate} · Tanpa catatan · Booth ${selectedBooth} · Pegawai: ${officer.fullName}`,
      });
      onLogsChanged();
    } catch (err) {
      recentSubmitGuardRef.current.delete(normalizedPlate);
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan rekod kenderaan.',
      });
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const handleInlineSave = async (
    logId: string,
    updates: {
      boothNo?: BoothNo;
      plateNo?: string;
      notes?: string;
      eventTimestamp?: string;
    }
  ) => {
    try {
      await updateVehicleLog(logId, updates);
      onLogsChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `Gagal mengemas kini baris: ${err.message}`
            : 'Gagal mengemas kini rekod.',
      });
    }
  };

  const handleDeleteRow = async (logId: string) => {
    try {
      await deleteVehicleLog(logId);
      onLogsChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `Gagal memadam baris: ${err.message}`
            : 'Gagal memadam rekod.',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Operational Header Card (matching Image 3 clean white summary card) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {isIncoming ? (
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-[#072B7A]" />
            )}
            <span>{isIncoming ? 'Kaunter Masuk (Booth 5–10)' : 'Kaunter Keluar (Booth 1–4)'}</span>
            <span aria-hidden="true">·</span>
            <span>Pegawai bertugas: {officer.fullName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isIncoming ? 'VMS IN — Rekod Kenderaan Masuk' : 'VMS OUT — Rekod Kenderaan Keluar'}
          </h1>
        </div>

        <div className="flex items-center gap-6 text-sm shrink-0">
          <div>
            <div className="text-xs text-slate-500">Hari Ini (Booth {selectedBooth})</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {selectedBoothTodayCount}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <div className="text-xs text-slate-500">
              Jumlah {isIncoming ? 'Masuk' : 'Keluar'} Hari Ini
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#072B7A]">
              {todayCount}
            </div>
          </div>
        </div>
      </section>

      {/* Primary Entry Terminal Box */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="sm:w-44 shrink-0">
            <label
              htmlFor="booth-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Booth No ({isIncoming ? '5–10' : '1–4'})
            </label>
            <select
              id="booth-select"
              value={selectedBooth}
              onChange={(e) => {
                setSelectedBooth(e.target.value as BoothNo);
                inputRef.current?.focus();
              }}
              className="w-full h-11 px-3 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#072B7A]/15 transition-colors cursor-pointer"
            >
              {boothOptions.map((b) => (
                <option key={b} value={b}>
                  Booth {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label
              htmlFor="plate-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nombor Plat Kenderaan (Tekan Enter untuk rekod)
            </label>
            <input
              ref={inputRef}
              id="plate-input"
              type="text"
              autoFocus
              autoComplete="off"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Contoh: BBW2459, BBW2459-1W, JKDM/08/40965/26, atau imbas kod J3.0..."
              className="w-full h-11 px-3.5 text-base font-mono font-semibold tracking-wide text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-sm placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg focus:border-[#072B7A] focus:outline-none focus:ring-2 focus:ring-[#072B7A]/15 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !rawInput.trim()}
            className="h-11 px-5 text-sm font-semibold text-white bg-[#007BFF] hover:bg-[#0069D9] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isIncoming ? 'Rekod Masuk' : 'Rekod Keluar'}
          </button>
        </form>

        {/* Live Parser Preview & Format Guide */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-slate-500 border-t border-slate-100">
          {livePreview ? (
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="font-medium text-slate-500">Pratonton auto-ekstrak ({livePreview.formatLabel}):</span>
              <span className="font-mono font-bold text-slate-900">{livePreview.plateNo}</span>
              <span aria-hidden="true">·</span>
              <span>
                Catatan:{' '}
                <strong className="font-semibold text-slate-900">
                  {livePreview.notes || 'Tiada'}
                </strong>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Format disokong:</span>
              <span className="font-mono text-slate-700">BBW2459</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">BBW2459-1W</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">JKDM/08/40965/26</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">J3.0;...;BAC8228;...^</span>
            </div>
          )}
          <span className="text-slate-400 shrink-0">
            Sunting terus dalam jadual tanpa butang edit · Auto-hapus pendua 5 minit
          </span>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-sm border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedback.type === 'duplicate'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  feedback.type === 'duplicate' ? 'text-amber-600' : 'text-red-600'
                }`}
              />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}
      </section>

      {/* Recent Records Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isIncoming
                ? 'Senarai Rekod Kenderaan Masuk Terkini'
                : 'Senarai Rekod Kenderaan Keluar Terkini'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik terus pada mana-mana sel untuk mengemas kini secara automatik.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              aria-label="Tapis mengikut booth"
              value={boothFilter}
              onChange={(e) => setBoothFilter(e.target.value)}
              className="h-9 px-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:outline-none"
            >
              <option value="ALL">Semua Booth</option>
              {boothOptions.map((b) => (
                <option key={b} value={b}>
                  Booth {b}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. plat / catatan / pegawai..."
                className="h-9 pl-8 pr-3 w-52 sm:w-60 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 pl-4 pr-2">Booth No</th>
                <th className="py-2.5 px-2">No. Plat</th>
                <th className="py-2.5 px-2">
                  {isIncoming ? 'Tarikh & Masa Masuk' : 'Tarikh & Masa Keluar'}
                </th>
                <th className="py-2.5 px-2">Catatan</th>
                <th className="py-2.5 px-2">Nama Pegawai</th>
                <th className="py-2.5 pl-2 pr-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 pl-4 pr-2">
                      <div className="h-5 w-20 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-5 w-44 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-5 w-28 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-5 w-36 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="py-3 pl-2 pr-4 text-right">
                      <div className="h-5 w-16 bg-slate-100 rounded animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {directionLogs.length === 0
                        ? `Belum ada rekod kenderaan ${isIncoming ? 'masuk' : 'keluar'}.`
                        : 'Tiada rekod sepadan dengan penapis carian anda.'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {directionLogs.length === 0
                        ? 'Masukkan nombor plat pada kotak di atas dan tekan Enter untuk mula merekod.'
                        : 'Cuba padam teks carian atau pilih Semua Booth.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((rec) => (
                  <InlineLogRow
                    key={rec.id}
                    record={rec}
                    boothOptions={boothOptions}
                    onSave={handleInlineSave}
                    onDelete={handleDeleteRow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>
              Memaparkan {filteredLogs.length} daripada {directionLogs.length} rekod
            </span>
            <span>Auto-simpan aktif</span>
          </div>
        )}
      </section>
    </div>
  );
};
