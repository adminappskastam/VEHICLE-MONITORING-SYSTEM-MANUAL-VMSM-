import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  List,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  BOOTH_IN_LIST,
  BOOTH_OUT_LIST,
  VehicleLogRecord,
} from '../types/vms';
import {
  buildDailyStatistics,
  formatDateKeyDisplay,
  formatDateTimeDisplay,
  formatDurationMinutes,
  getEffectiveTimeMs,
  pairVehicleLogs,
  toLocalDateKey,
} from '../utils/plateParser';

interface VmsDashboardPageProps {
  allLogs: VehicleLogRecord[];
  isLoading: boolean;
}

type DashboardViewMode = 'LIST' | 'GRAPH';

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

function downloadCsvFile(filename: string, headers: string[], rows: string[][]) {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const VmsDashboardPage: React.FC<VmsDashboardPageProps> = ({
  allLogs,
  isLoading,
}) => {
  const [viewMode, setViewMode] = useState<DashboardViewMode>('LIST');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [boothInFilter, setBoothInFilter] = useState('ALL');
  const [boothOutFilter, setBoothOutFilter] = useState('ALL');
  const [plateSearch, setPlateSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SELESAI' | 'DI_DALAM' | 'KELUAR_SAHAJA'>('ALL');
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);

  const hasActiveFilters = Boolean(
    startDate ||
      endDate ||
      boothInFilter !== 'ALL' ||
      boothOutFilter !== 'ALL' ||
      plateSearch.trim() ||
      statusFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setBoothInFilter('ALL');
    setBoothOutFilter('ALL');
    setPlateSearch('');
    setStatusFilter('ALL');
  };

  const allCombinedTrips = useMemo(() => pairVehicleLogs(allLogs), [allLogs]);

  const filteredTrips = useMemo(() => {
    const query = plateSearch.trim().toUpperCase();
    return allCombinedTrips.filter((trip) => {
      if (query) {
        const matchPlate = trip.plateNo.toUpperCase().includes(query);
        const matchInNote = (trip.inRecord?.notes || '').toUpperCase().includes(query);
        const matchOutNote = (trip.outRecord?.notes || '').toUpperCase().includes(query);
        const matchInOfficer = (trip.inRecord?.officerName || '').toUpperCase().includes(query);
        const matchOutOfficer = (trip.outRecord?.officerName || '').toUpperCase().includes(query);
        if (!matchPlate && !matchInNote && !matchOutNote && !matchInOfficer && !matchOutOfficer) {
          return false;
        }
      }

      if (boothInFilter !== 'ALL') {
        if (trip.inRecord?.boothNo !== boothInFilter) return false;
      }

      if (boothOutFilter !== 'ALL') {
        if (trip.outRecord?.boothNo !== boothOutFilter) return false;
      }

      if (statusFilter !== 'ALL' && trip.status !== statusFilter) {
        return false;
      }

      if (startDate || endDate) {
        const inDateKey = trip.inTimeMs ? toLocalDateKey(trip.inTimeMs) : null;
        const outDateKey = trip.outTimeMs ? toLocalDateKey(trip.outTimeMs) : null;
        const matchesDateRange = (key: string | null) => {
          if (!key) return false;
          if (startDate && key < startDate) return false;
          if (endDate && key > endDate) return false;
          return true;
        };
        if (!matchesDateRange(inDateKey) && !matchesDateRange(outDateKey)) {
          return false;
        }
      }

      return true;
    });
  }, [
    allCombinedTrips,
    plateSearch,
    boothInFilter,
    boothOutFilter,
    statusFilter,
    startDate,
    endDate,
  ]);

  const { filteredInLogs, filteredOutLogs } = useMemo(() => {
    const query = plateSearch.trim().toUpperCase();
    const matchCommon = (log: VehicleLogRecord) => {
      if (query) {
        const matchPlate = log.plateNo.toUpperCase().includes(query);
        const matchNotes = log.notes.toUpperCase().includes(query);
        const matchOfficer = (log.officerName || '').toUpperCase().includes(query);
        if (!matchPlate && !matchNotes && !matchOfficer) return false;
      }
      const dateKey = toLocalDateKey(getEffectiveTimeMs(log));
      if (startDate && dateKey < startDate) return false;
      if (endDate && dateKey > endDate) return false;
      return true;
    };

    const inLogs = allLogs.filter(
      (l) =>
        l.direction === 'IN' &&
        matchCommon(l) &&
        (boothInFilter === 'ALL' || l.boothNo === boothInFilter)
    );

    const outLogs = allLogs.filter(
      (l) =>
        l.direction === 'OUT' &&
        matchCommon(l) &&
        (boothOutFilter === 'ALL' || l.boothNo === boothOutFilter)
    );

    return { filteredInLogs: inLogs, filteredOutLogs: outLogs };
  }, [allLogs, plateSearch, startDate, endDate, boothInFilter, boothOutFilter]);

  const dailyStats = useMemo(
    () => buildDailyStatistics(filteredInLogs, filteredOutLogs),
    [filteredInLogs, filteredOutLogs]
  );

  const chartDays = useMemo(() => {
    return [...dailyStats].slice(0, 14).reverse();
  }, [dailyStats]);

  const maxChartValue = useMemo(() => {
    let maxVal = 1;
    for (const d of chartDays) {
      if (d.inCount > maxVal) maxVal = d.inCount;
      if (d.outCount > maxVal) maxVal = d.outCount;
    }
    return maxVal;
  }, [chartDays]);

  const boothInBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of BOOTH_IN_LIST) counts.set(b, 0);
    for (const log of filteredInLogs) {
      counts.set(log.boothNo, (counts.get(log.boothNo) || 0) + 1);
    }
    const maxCount = Math.max(1, ...Array.from(counts.values()));
    return BOOTH_IN_LIST.map((b) => ({
      booth: b,
      count: counts.get(b) || 0,
      pct: Math.round(((counts.get(b) || 0) / maxCount) * 100),
    }));
  }, [filteredInLogs]);

  const boothOutBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of BOOTH_OUT_LIST) counts.set(b, 0);
    for (const log of filteredOutLogs) {
      counts.set(log.boothNo, (counts.get(log.boothNo) || 0) + 1);
    }
    const maxCount = Math.max(1, ...Array.from(counts.values()));
    return BOOTH_OUT_LIST.map((b) => ({
      booth: b,
      count: counts.get(b) || 0,
      pct: Math.round(((counts.get(b) || 0) / maxCount) * 100),
    }));
  }, [filteredOutLogs]);

  const kpiTotals = useMemo(() => {
    const activeInside = filteredTrips.filter((t) => t.status === 'DI_DALAM').length;
    const completedTrips = filteredTrips.filter((t) => t.status === 'SELESAI').length;
    return {
      totalIn: filteredInLogs.length,
      totalOut: filteredOutLogs.length,
      activeInside,
      completedTrips,
    };
  }, [filteredInLogs.length, filteredOutLogs.length, filteredTrips]);

  const hoveredDay = useMemo(
    () => chartDays.find((d) => d.dateKey === hoveredDayKey) || null,
    [chartDays, hoveredDayKey]
  );

  const handleExportCombinedCsv = () => {
    const headers = [
      'No. Plat',
      'Booth Masuk',
      'Tarikh & Masa Masuk',
      'Catatan Masuk',
      'Pegawai Masuk',
      'Booth Keluar',
      'Tarikh & Masa Keluar',
      'Catatan Keluar',
      'Pegawai Keluar',
      'Tempoh',
      'Status',
    ];
    const rows = filteredTrips.map((t) => [
      t.plateNo,
      t.inRecord ? `Booth ${t.inRecord.boothNo}` : '-',
      t.inRecord ? formatDateTimeDisplay(t.inRecord.eventTimestamp) : '-',
      t.inRecord?.notes || '-',
      t.inRecord?.officerName || t.inRecord?.createdByEmail || '-',
      t.outRecord ? `Booth ${t.outRecord.boothNo}` : '-',
      t.outRecord ? formatDateTimeDisplay(t.outRecord.eventTimestamp) : '-',
      t.outRecord?.notes || '-',
      t.outRecord?.officerName || t.outRecord?.createdByEmail || '-',
      formatDurationMinutes(t.durationMinutes),
      t.status === 'SELESAI'
        ? 'Selesai'
        : t.status === 'DI_DALAM'
        ? 'Di Dalam'
        : 'Keluar Sahaja',
    ]);
    const dateTag = toLocalDateKey(Date.now());
    downloadCsvFile(`vmsm-rekod-keluar-masuk-${dateTag}.csv`, headers, rows);
  };

  const handleExportDailyCsv = () => {
    const headers = [
      'Tarikh',
      'Jumlah Masuk (Booth 5-10)',
      'Jumlah Keluar (Booth 1-4)',
      'Baki / Belum Keluar',
      'Kadar Keluar (%)',
    ];
    const rows = dailyStats.map((d) => [
      d.displayDate,
      String(d.inCount),
      String(d.outCount),
      String(d.netBalance),
      `${d.completionRate}%`,
    ]);
    const dateTag = toLocalDateKey(Date.now());
    downloadCsvFile(`vmsm-laporan-harian-${dateTag}.csv`, headers, rows);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Official Print Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          Vehicle Monitoring System Manual (VMSM) — Laporan Keluar Masuk Kenderaan
        </h1>
        <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-4">
          <span>
            Tempoh:{' '}
            {startDate ? formatDateKeyDisplay(startDate) : 'Semua'} hingga{' '}
            {endDate ? formatDateKeyDisplay(endDate) : 'Terkini'}
          </span>
          <span>Booth IN: {boothInFilter === 'ALL' ? 'Semua (5–10)' : `Booth ${boothInFilter}`}</span>
          <span>Booth OUT: {boothOutFilter === 'ALL' ? 'Semua (1–4)' : `Booth ${boothOutFilter}`}</span>
          <span>Dijana pada: {formatDateTimeDisplay(new Date().toISOString())}</span>
        </div>
      </div>

      {/* Top Header Row: Title + 2 View Mode Buttons + Exports */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Analitik Operasi &amp; Penjanaan Laporan Rasmi
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            VMS Dashboard — Statistik &amp; Rekod Gabungan
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Two Distinct Buttons Separating List vs Graph (Image 4 requirement) */}
          <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-[#072B7A] text-[#FACC15] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Senarai Rekod</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRAPH')}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'GRAPH'
                  ? 'bg-[#072B7A] text-[#FACC15] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Graf &amp; Statistik</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          <button
            type="button"
            onClick={handleExportDailyCsv}
            disabled={dailyStats.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Laporan Harian</span>
          </button>

          <button
            type="button"
            onClick={handleExportCombinedCsv}
            disabled={filteredTrips.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Senarai Gabungan</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-[#007BFF] hover:bg-[#0069D9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label htmlFor="filter-start-date" className="block text-xs font-medium text-slate-600 mb-1">
              Tarikh Mula
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="filter-end-date" className="block text-xs font-medium text-slate-600 mb-1">
              Tarikh Tamat
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="filter-booth-in" className="block text-xs font-medium text-slate-600 mb-1">
              Booth VMS IN
            </label>
            <select
              id="filter-booth-in"
              value={boothInFilter}
              onChange={(e) => setBoothInFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Booth IN (5–10)</option>
              {BOOTH_IN_LIST.map((b) => (
                <option key={b} value={b}>
                  Booth {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-booth-out" className="block text-xs font-medium text-slate-600 mb-1">
              Booth VMS OUT
            </label>
            <select
              id="filter-booth-out"
              value={boothOutFilter}
              onChange={(e) => setBoothOutFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Booth OUT (1–4)</option>
              {BOOTH_OUT_LIST.map((b) => (
                <option key={b} value={b}>
                  Booth {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-plate-search" className="block text-xs font-medium text-slate-600 mb-1">
              Cari No. Plat / Pegawai
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="filter-plate-search"
                type="text"
                value={plateSearch}
                onChange={(e) => setPlateSearch(e.target.value)}
                placeholder="cth. BBA5647"
                className="w-full h-9 pl-8 pr-2.5 text-xs font-mono uppercase text-slate-900 placeholder:normal-case placeholder:font-sans bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Tapis status pergerakan"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'SELESAI' | 'DI_DALAM' | 'KELUAR_SAHAJA')
              }
              className="flex-1 h-9 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#072B7A] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="SELESAI">Selesai (IN &amp; OUT)</option>
              <option value="DI_DALAM">Di Dalam</option>
              <option value="KELUAR_SAHAJA">Keluar Sahaja</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Set semula penapis"
                className="h-9 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Jumlah Kenderaan Masuk</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {kpiTotals.totalIn}
          </div>
          <div className="text-xs text-slate-400 mt-1">Kaunter VMS IN (Booth 5–10)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Jumlah Kenderaan Keluar</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#072B7A] mt-1">
            {kpiTotals.totalOut}
          </div>
          <div className="text-xs text-slate-400 mt-1">Kaunter VMS OUT (Booth 1–4)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Masih Di Dalam</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
            {kpiTotals.activeInside}
          </div>
          <div className="text-xs text-slate-400 mt-1">Rekod IN belum dipadankan OUT</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Pergerakan Selesai</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpiTotals.completedTrips}
          </div>
          <div className="text-xs text-slate-400 mt-1">Pasangan rekod Masuk &amp; Keluar</div>
        </div>
      </section>

      {/* VIEW 1: GRAPH & CHARTS */}
      {viewMode === 'GRAPH' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-break-inside-avoid">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Carta Statistik Harian (Masuk vs Keluar)
                </h2>
                <p className="text-xs text-slate-500">
                  Perbandingan trafik harian sehingga 14 hari terkini
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  Masuk (IN)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#072B7A] inline-block" />
                  Keluar (OUT)
                </span>
              </div>
            </div>

            {chartDays.length === 0 ? (
              <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                Tiada data statistik untuk dipaparkan bagi penapis semasa.
              </div>
            ) : (
              <div className="relative">
                <div className="h-6 mb-2 flex items-center justify-end text-xs font-mono tabular-nums text-slate-600">
                  {hoveredDay ? (
                    <span>
                      {hoveredDay.displayDate} — Masuk:{' '}
                      <strong className="text-emerald-700">{hoveredDay.inCount}</strong> · Keluar:{' '}
                      <strong className="text-[#072B7A]">{hoveredDay.outCount}</strong> · Baki:{' '}
                      <strong>{hoveredDay.netBalance}</strong>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-sans">
                      Arahkan tetikus ke bar untuk perincian harian
                    </span>
                  )}
                </div>

                <div className="h-64 flex items-end gap-2 pt-4 pb-1 border-b border-slate-200">
                  {chartDays.map((day) => {
                    const inHeightPct = Math.round((day.inCount / maxChartValue) * 100);
                    const outHeightPct = Math.round((day.outCount / maxChartValue) * 100);
                    const isHovered = hoveredDayKey === day.dateKey;

                    return (
                      <div
                        key={day.dateKey}
                        onMouseEnter={() => setHoveredDayKey(day.dateKey)}
                        onMouseLeave={() => setHoveredDayKey(null)}
                        className={`flex-1 h-full flex flex-col justify-end items-center gap-1.5 rounded-t-md px-1 transition-colors cursor-default ${
                          isHovered ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div className="w-full h-52 flex items-end justify-center gap-1.5">
                          <div
                            style={{ height: `${Math.max(day.inCount > 0 ? 6 : 0, inHeightPct)}%` }}
                            className="w-3.5 sm:w-5 bg-emerald-600 hover:bg-emerald-500 rounded-t-sm transition-all"
                            title={`${day.displayDate} Masuk: ${day.inCount}`}
                          />
                          <div
                            style={{ height: `${Math.max(day.outCount > 0 ? 6 : 0, outHeightPct)}%` }}
                            className="w-3.5 sm:w-5 bg-[#072B7A] hover:bg-blue-700 rounded-t-sm transition-all"
                            title={`${day.displayDate} Keluar: ${day.outCount}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {chartDays.map((day) => (
                    <div
                      key={day.dateKey}
                      className="flex-1 text-center text-[11px] font-mono tabular-nums text-slate-500 truncate"
                    >
                      {day.displayDate.slice(0, 5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pecahan Trafik Booth</h2>
              <p className="text-xs text-slate-500">Agihan rekod mengikut kaunter booth</p>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">VMS IN (Booth 5–10)</div>
              {boothInBreakdown.map((item) => (
                <div key={item.booth} className="flex items-center gap-2.5 text-xs">
                  <span className="w-16 font-mono text-slate-600 shrink-0">Booth {item.booth}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.pct}%` }}
                      className="h-full bg-emerald-600 rounded-full transition-all"
                    />
                  </div>
                  <span className="w-8 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">VMS OUT (Booth 1–4)</div>
              {boothOutBreakdown.map((item) => (
                <div key={item.booth} className="flex items-center gap-2.5 text-xs">
                  <span className="w-16 font-mono text-slate-600 shrink-0">Booth {item.booth}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.pct}%` }}
                      className="h-full bg-[#072B7A] rounded-full transition-all"
                    />
                  </div>
                  <span className="w-8 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VIEW 2: LIST & DAILY SUMMARY REPORT (Also shown on print) */}
      <div className={viewMode === 'LIST' ? 'space-y-5' : 'hidden print-only space-y-5'}>
        {/* Daily Statistics Report Table */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Laporan Keluar Masuk Harian
              </h2>
              <p className="text-xs text-slate-500">
                Ringkasan jumlah kenderaan masuk dan keluar mengikut tarikh
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {dailyStats.length} hari direkodkan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 pl-5 pr-3">Tarikh</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Masuk (IN)</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Keluar (OUT)</th>
                  <th className="py-2.5 px-3 text-right">Beza (Masuk - Keluar)</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Kadar Keluar</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      Tiada laporan harian ditemui bagi kriteria penapis semasa.
                    </td>
                  </tr>
                ) : (
                  dailyStats.map((row) => (
                    <tr key={row.dateKey} className="border-b border-slate-100 hover:bg-slate-50/70 text-sm">
                      <td className="py-2.5 pl-5 pr-3 font-mono font-medium tabular-nums text-slate-900">
                        {row.displayDate}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-emerald-700">
                        {row.inCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#072B7A]">
                        {row.outCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.netBalance > 0 ? `+${row.netBalance}` : row.netBalance}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums text-slate-700">
                        {row.completionRate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {dailyStats.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-900">
                    <td className="py-2.5 pl-5 pr-3">JUMLAH KESELURUHAN</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {kpiTotals.totalIn}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#072B7A]">
                      {kpiTotals.totalOut}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {kpiTotals.totalIn - kpiTotals.totalOut}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums">
                      {kpiTotals.totalIn > 0
                        ? `${Math.min(100, Math.round((kpiTotals.totalOut / kpiTotals.totalIn) * 100))}%`
                        : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* Combined Vehicle IN & OUT Table */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Gabungan Senarai Kenderaan Masuk &amp; Keluar
              </h2>
              <p className="text-xs text-slate-500">
                Padanan automatik tarikh/masa masuk, tarikh/masa keluar, catatan, dan nama pegawai
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {filteredTrips.length} rekod dipaparkan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 pl-5 pr-3">No. Plat</th>
                  <th className="py-2.5 px-3">Booth IN</th>
                  <th className="py-2.5 px-3">Tarikh &amp; Masa Masuk</th>
                  <th className="py-2.5 px-3">Booth OUT</th>
                  <th className="py-2.5 px-3">Tarikh &amp; Masa Keluar</th>
                  <th className="py-2.5 px-3">Catatan Masuk / Keluar</th>
                  <th className="py-2.5 px-3">Nama Pegawai (IN / OUT)</th>
                  <th className="py-2.5 px-3 text-right">Tempoh</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      {Array.from({ length: 9 }).map((__, colIdx) => (
                        <td key={colIdx} className="py-3 px-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 px-4 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        Tiada rekod gabungan ditemui.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Rekod daripada VMS IN dan VMS OUT akan dipadankan secara automatik di sini.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => {
                    const inNote = trip.inRecord?.notes || '';
                    const outNote = trip.outRecord?.notes || '';
                    let combinedNotes = '—';
                    if (inNote && outNote) {
                      combinedNotes = `${inNote} / ${outNote}`;
                    } else if (inNote) {
                      combinedNotes = `Masuk: ${inNote}`;
                    } else if (outNote) {
                      combinedNotes = `Keluar: ${outNote}`;
                    }

                    const inOfficer = trip.inRecord?.officerName || trip.inRecord?.createdByEmail || '';
                    const outOfficer = trip.outRecord?.officerName || trip.outRecord?.createdByEmail || '';
                    let combinedOfficers = '—';
                    if (inOfficer && outOfficer) {
                      combinedOfficers =
                        inOfficer === outOfficer
                          ? inOfficer
                          : `IN: ${inOfficer} / OUT: ${outOfficer}`;
                    } else if (inOfficer) {
                      combinedOfficers = `IN: ${inOfficer}`;
                    } else if (outOfficer) {
                      combinedOfficers = `OUT: ${outOfficer}`;
                    }

                    return (
                      <tr
                        key={trip.tripId}
                        className="border-b border-slate-100 hover:bg-slate-50/70 text-sm transition-colors"
                      >
                        <td className="py-2.5 pl-5 pr-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {trip.plateNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {trip.inRecord ? `Booth ${trip.inRecord.boothNo}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {trip.inRecord
                            ? formatDateTimeDisplay(trip.inRecord.eventTimestamp)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {trip.outRecord ? `Booth ${trip.outRecord.boothNo}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {trip.outRecord
                            ? formatDateTimeDisplay(trip.outRecord.eventTimestamp)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700 max-w-[200px] truncate" title={combinedNotes}>
                          {combinedNotes}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-medium text-slate-700 max-w-[220px] truncate" title={combinedOfficers}>
                          {combinedOfficers}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {formatDurationMinutes(trip.durationMinutes)}
                        </td>
                        <td className="py-2.5 pl-3 pr-5 text-right text-xs font-semibold whitespace-nowrap">
                          {trip.status === 'SELESAI' ? (
                            <span className="text-emerald-700">Selesai</span>
                          ) : trip.status === 'DI_DALAM' ? (
                            <span className="text-amber-600">Di Dalam</span>
                          ) : (
                            <span className="text-slate-500">Keluar Sahaja</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
