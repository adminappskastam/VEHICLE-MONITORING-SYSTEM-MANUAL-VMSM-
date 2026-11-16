export type Direction = 'IN' | 'OUT';

export type BoothIn = '5' | '6' | '7' | '8' | '9' | '10';
export type BoothOut = '1' | '2' | '3' | '4';
export type BoothNo = BoothIn | BoothOut;

export const BOOTH_IN_LIST: BoothIn[] = ['5', '6', '7', '8', '9', '10'];
export const BOOTH_OUT_LIST: BoothOut[] = ['1', '2', '3', '4'];

export type OfficerRole = 'ADMIN' | 'PEGAWAI';

export interface OfficerProfile {
  id: string;
  fullName: string;
  grade: string;
  badgeNo: string;
  email: string;
  role: OfficerRole;
  firebaseSynced?: boolean;
  updatedAtMs?: number;
}

export interface VehicleLogRecord {
  id: string;
  direction: Direction;
  boothNo: BoothNo;
  plateNo: string;
  notes: string;
  eventTimestamp: string;
  officerName: string;
  createdBy: string;
  createdByEmail: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export type TripStatus = 'SELESAI' | 'DI_DALAM' | 'KELUAR_SAHAJA';

export interface CombinedVehicleTrip {
  tripId: string;
  plateNo: string;
  inRecord: VehicleLogRecord | null;
  outRecord: VehicleLogRecord | null;
  inTimeMs: number | null;
  outTimeMs: number | null;
  sortTimeMs: number;
  durationMinutes: number | null;
  status: TripStatus;
}

export interface DailyStatRow {
  dateKey: string;
  displayDate: string;
  inCount: number;
  outCount: number;
  netBalance: number;
  completionRate: number;
}
