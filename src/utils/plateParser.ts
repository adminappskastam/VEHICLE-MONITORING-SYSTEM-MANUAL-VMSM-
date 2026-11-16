import { CombinedVehicleTrip, DailyStatRow, VehicleLogRecord } from '../types/vms';

export interface ParsedPlateResult {
  plateNo: string;
  notes: string;
  formatLabel: string;
}

/**
 * Parses officer input or scanned barcode/QR string into plateNo + notes:
 * 1. "BBW2459" -> plateNo: "BBW2459", notes: ""
 * 2. "BBW2459-1W" -> plateNo: "BBW2459", notes: "1W"
 * 3. "JKDM/08/40965/26" -> plateNo: "JKDM/08/40965/26", notes: ""
 * 4. "J3.0;15491959;...;BN096;BAC8228;MERCEDES-BENZ E200;...^" -> plateNo: "BAC8228", notes: ""
 */
export function parsePlateInput(rawInput: string): ParsedPlateResult | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  // Case 4: Semicolon-delimited J3.0 or smart-card/barcode payload
  if (trimmed.includes(';')) {
    const parts = trimmed.split(';');
    if (parts.length > 10 && parts[10].trim().length > 0) {
      const extracted = parts[10].trim().toUpperCase().slice(0, 64);
      return {
        plateNo: extracted,
        notes: '',
        formatLabel: 'Kod Bar J3.0',
      };
    }
    // Fallback if semicolon string has fewer segments
    const candidate = parts.find((p) => /^[A-Za-z]{1,4}\d{1,5}[A-Za-z0-9/]*$/.test(p.trim()));
    if (candidate) {
      return {
        plateNo: candidate.trim().toUpperCase().slice(0, 64),
        notes: '',
        formatLabel: 'Kod Bar Semicolon',
      };
    }
  }

  // Case 2: Plate with hyphenated note, e.g., BBW2459-1W
  const dashIndex = trimmed.indexOf('-');
  if (dashIndex > 0) {
    const platePart = trimmed.slice(0, dashIndex).trim().toUpperCase().slice(0, 64);
    const notePart = trimmed.slice(dashIndex + 1).trim().slice(0, 200);
    if (platePart.length > 0) {
      return {
        plateNo: platePart,
        notes: notePart,
        formatLabel: notePart ? 'Plat + Catatan' : 'Standard',
      };
    }
  }

  // Case 1 & Case 3: Standard plate (BBW2459) or slash pass (JKDM/08/40965/26)
  return {
    plateNo: trimmed.toUpperCase().slice(0, 64),
    notes: '',
    formatLabel: trimmed.includes('/') ? 'Pas Rasmi' : 'Standard',
  };
}

/**
 * Checks whether the same plateNo was already recorded in the same direction
 * within the 5-minute deduplication window (300,000 ms).
 */
export function findRecentDuplicateLog(
  logs: VehicleLogRecord[],
  plateNo: string,
  targetTimeMs: number,
  windowMs = 5 * 60 * 1000
): VehicleLogRecord | null {
  const normalized = plateNo.trim().toUpperCase();
  for (const log of logs) {
    if (log.plateNo.trim().toUpperCase() !== normalized) {
      continue;
    }
    const logTimeMs = getEffectiveTimeMs(log);
    if (Math.abs(targetTimeMs - logTimeMs) <= windowMs) {
      return log;
    }
  }
  return null;
}

export function getEffectiveTimeMs(log: VehicleLogRecord): number {
  const parsed = Date.parse(log.eventTimestamp);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return log.createdAtMs || 0;
}

export function formatDateTimeDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

export function formatTimeOnly(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
}

export function toLocalDateKey(dateMs: number): string {
  const d = new Date(dateMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateKeyDisplay(dateKey: string): string {
  const [yyyy, mm, dd] = dateKey.split('-');
  if (!yyyy || !mm || !dd) return dateKey;
  return `${dd}/${mm}/${yyyy}`;
}

export function toDateTimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

export function fromDateTimeLocalValue(localValue: string): string | null {
  if (!localValue) return null;
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}j ${mins}m`;
}

/**
 * Pairs chronological IN and OUT events for each vehicle plate number
 * so the dashboard displays a combined IN/OUT movement ledger.
 */
export function pairVehicleLogs(logs: VehicleLogRecord[]): CombinedVehicleTrip[] {
  const sortedAsc = [...logs].sort((a, b) => getEffectiveTimeMs(a) - getEffectiveTimeMs(b));
  const openInQueues = new Map<string, VehicleLogRecord[]>();
  const trips: CombinedVehicleTrip[] = [];

  for (const log of sortedAsc) {
    const key = log.plateNo.trim().toUpperCase();
    if (log.direction === 'IN') {
      const queue = openInQueues.get(key) ?? [];
      queue.push(log);
      openInQueues.set(key, queue);
    } else {
      const queue = openInQueues.get(key);
      if (queue && queue.length > 0) {
        const matchedIn = queue.shift()!;
        const inTimeMs = getEffectiveTimeMs(matchedIn);
        const outTimeMs = getEffectiveTimeMs(log);
        const durationMinutes = Math.max(0, Math.round((outTimeMs - inTimeMs) / 60000));
        trips.push({
          tripId: `${matchedIn.id}__${log.id}`,
          plateNo: matchedIn.plateNo,
          inRecord: matchedIn,
          outRecord: log,
          inTimeMs,
          outTimeMs,
          sortTimeMs: Math.max(inTimeMs, outTimeMs),
          durationMinutes,
          status: 'SELESAI',
        });
      } else {
        const outTimeMs = getEffectiveTimeMs(log);
        trips.push({
          tripId: `out_${log.id}`,
          plateNo: log.plateNo,
          inRecord: null,
          outRecord: log,
          inTimeMs: null,
          outTimeMs,
          sortTimeMs: outTimeMs,
          durationMinutes: null,
          status: 'KELUAR_SAHAJA',
        });
      }
    }
  }

  for (const queue of openInQueues.values()) {
    for (const unmatchedIn of queue) {
      const inTimeMs = getEffectiveTimeMs(unmatchedIn);
      trips.push({
        tripId: `in_${unmatchedIn.id}`,
        plateNo: unmatchedIn.plateNo,
        inRecord: unmatchedIn,
        outRecord: null,
        inTimeMs,
        outTimeMs: null,
        sortTimeMs: inTimeMs,
        durationMinutes: null,
        status: 'DI_DALAM',
      });
    }
  }

  return trips.sort((a, b) => b.sortTimeMs - a.sortTimeMs);
}

export function buildDailyStatistics(
  inLogs: VehicleLogRecord[],
  outLogs: VehicleLogRecord[]
): DailyStatRow[] {
  const map = new Map<string, { inCount: number; outCount: number }>();

  for (const log of inLogs) {
    const key = toLocalDateKey(getEffectiveTimeMs(log));
    const entry = map.get(key) ?? { inCount: 0, outCount: 0 };
    entry.inCount += 1;
    map.set(key, entry);
  }

  for (const log of outLogs) {
    const key = toLocalDateKey(getEffectiveTimeMs(log));
    const entry = map.get(key) ?? { inCount: 0, outCount: 0 };
    entry.outCount += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, counts]) => {
      const completionRate =
        counts.inCount > 0 ? Math.min(100, Math.round((counts.outCount / counts.inCount) * 100)) : counts.outCount > 0 ? 100 : 0;
      return {
        dateKey,
        displayDate: formatDateKeyDisplay(dateKey),
        inCount: counts.inCount,
        outCount: counts.outCount,
        netBalance: counts.inCount - counts.outCount,
        completionRate,
      };
    });
}
