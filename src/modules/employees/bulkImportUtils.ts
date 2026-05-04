import * as XLSX from 'xlsx';
import { createEmployee } from '../../api/employees';
import { Employee, Company, Store, UserRole } from '../../types';

/* ── Column header → API field mapping ─────────────────────────────────── */
const COLUMN_MAP: Record<string, string> = {
  'name': 'name',
  'surname': 'surname',
  'email': 'email',
  'role': 'role',
  'company': 'companyName',
  'store': 'storeName',
  'supervisor': 'supervisorName',
  'department': 'department',
  'temporary password': 'password',
  'hire date': 'hireDate',
  'contract end': 'contractEndDate',
  'work schedule': 'workingType',
  'weekly hours': 'weeklyHours',
  'personal email': 'personalEmail',
  'date of birth': 'dateOfBirth',
  'nationality': 'nationality',
  'gender': 'gender',
  'iban': 'iban',
  'country': 'country',
  'state': 'state',
  'city': 'city',
  'address': 'address',
  'postal code': 'cap',
  'company phone numbers': 'phone',
  'marital status': 'maritalStatus',
  'first aid': 'firstAidFlag',
  'contract type': 'contractType',
  'probation period': 'probationMonths',
  'termination date': 'terminationDate',
  'termination type': 'terminationType',
};

const ROLE_VALUES: UserRole[] = ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];

const WORKING_TYPE_MAP: Record<string, string> = {
  'full time': 'full_time', 'full_time': 'full_time', 'fulltime': 'full_time',
  'part time': 'part_time', 'part_time': 'part_time', 'parttime': 'part_time',
  'part-time': 'part_time', 'full-time': 'full_time',
};

const GENDER_MAP: Record<string, string> = {
  'm': 'M', 'male': 'M', 'maschile': 'M',
  'f': 'F', 'female': 'F', 'femminile': 'F',
  'other': 'other', 'altro': 'other',
};

const MARITAL_VALUES = [
  'Celibe', 'Nubile', 'Coniugato', 'Coniugata', 'Divorziato', 'Divorziata',
  'Vedovo', 'Vedova', 'Separato', 'Separata', 'Unione Civile',
];

const CONTRACT_TYPE_VALUES = [
  'Tempo Indeterminato', 'Tempo Determinato', 'Apprendistato',
  'Stage / Tirocinio', 'Partita IVA / Collaborazione', 'Altro',
];

const TERMINATION_TYPE_VALUES = [
  'Dimissioni volontarie', 'Fine contratto', 'Licenziamento',
  'Pensionamento', 'Risoluzione consensuale', 'Altro',
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function generateUniqueId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'EMP-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#!$%&';
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function parseExcelDate(value: unknown): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'number') {
    // Excel date serial number
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = String(date.y).padStart(4, '0');
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(value).trim();
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  return str;
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toLowerCase();
  return str === 'true' || str === 'yes' || str === '1' || str === 'sì' || str === 'si';
}

function matchDropdown(value: string, options: string[]): string | null {
  const lower = value.trim().toLowerCase();
  const found = options.find(o => o.toLowerCase() === lower);
  return found ?? null;
}

/* ── Parse Excel File ──────────────────────────────────────────────────── */

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, unknown>;
}

export function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const rows: ParsedRow[] = json.map((row, i) => ({ rowIndex: i + 2, data: row }));
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/* ── Map + Validate + Create ───────────────────────────────────────────── */

export interface ImportResult {
  rowIndex: number;
  success: boolean;
  error?: string;
  employee?: Employee;
}

export async function processRow(
  row: ParsedRow,
  companies: Company[],
  stores: Store[],
  supervisors: Employee[],
): Promise<ImportResult> {
  const { rowIndex, data } = row;
  // 1. Map columns
  const mapped: Record<string, string> = {};
  for (const [header, value] of Object.entries(data)) {
    const key = COLUMN_MAP[header.trim().toLowerCase()];
    if (key) mapped[key] = String(value ?? '').trim();
  }

  // 2. Required fields
  if (!mapped.name) return { rowIndex, success: false, error: 'Missing required field: Name' };
  if (!mapped.surname) return { rowIndex, success: false, error: 'Missing required field: Surname' };
  if (!mapped.email) return { rowIndex, success: false, error: 'Missing required field: Email' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) {
    return { rowIndex, success: false, error: 'Invalid email format' };
  }

  // 3. Role
  const roleLower = (mapped.role || '').toLowerCase().replace(/\s+/g, '_');
  const role = ROLE_VALUES.find(r => r === roleLower);
  if (!role) return { rowIndex, success: false, error: `Missing or invalid role: "${mapped.role || ''}"` };

  // 4. Company lookup by name
  let companyId: number | undefined;
  if (mapped.companyName) {
    const company = companies.find(c => c.name.toLowerCase() === mapped.companyName.toLowerCase());
    if (company) companyId = company.id;
    else return { rowIndex, success: false, error: `Company not found: "${mapped.companyName}"` };
  }

  // 5. Store lookup by name
  let storeId: number | null = null;
  if (mapped.storeName) {
    const storeList = companyId ? stores.filter(s => s.companyId === companyId) : stores;
    const store = storeList.find(s => s.name.toLowerCase() === mapped.storeName.toLowerCase());
    if (store) storeId = store.id;
    // skip silently if not found
  }

  // 6. Supervisor lookup by name
  let supervisorId: number | null = null;
  if (mapped.supervisorName) {
    const supName = mapped.supervisorName.toLowerCase();
    const sup = supervisors.find(s => {
      const full = `${s.name} ${s.surname}`.toLowerCase();
      return full === supName || s.email.toLowerCase() === supName;
    });
    if (sup) supervisorId = sup.id;
  }

  // 7. Dropdown fields
  const workingType = mapped.workingType ? (WORKING_TYPE_MAP[mapped.workingType.toLowerCase()] || null) : null;
  const gender = mapped.gender ? (GENDER_MAP[mapped.gender.toLowerCase()] || null) : null;
  const maritalStatus = mapped.maritalStatus ? matchDropdown(mapped.maritalStatus, MARITAL_VALUES) : null;
  const contractType = mapped.contractType ? matchDropdown(mapped.contractType, CONTRACT_TYPE_VALUES) : null;
  const terminationType = mapped.terminationType ? matchDropdown(mapped.terminationType, TERMINATION_TYPE_VALUES) : null;

  // 8. Build payload
  const payload: Record<string, unknown> = {
    name: mapped.name,
    surname: mapped.surname,
    email: mapped.email,
    role,
    uniqueId: generateUniqueId(),
    password: mapped.password || generateTempPassword(),
    storeId,
    supervisorId,
    department: mapped.department || undefined,
    hireDate: parseExcelDate(data['Hire date'] ?? data['hire date'] ?? mapped.hireDate) || undefined,
    contractEndDate: parseExcelDate(data['Contract end'] ?? data['contract end'] ?? mapped.contractEndDate) || undefined,
    workingType,
    weeklyHours: mapped.weeklyHours ? parseFloat(mapped.weeklyHours) || null : null,
    personalEmail: mapped.personalEmail || null,
    dateOfBirth: parseExcelDate(data['Date of birth'] ?? data['date of birth'] ?? mapped.dateOfBirth) || null,
    nationality: mapped.nationality || null,
    gender,
    iban: mapped.iban || null,
    country: mapped.country || null,
    state: mapped.state || null,
    city: mapped.city || null,
    address: mapped.address || null,
    cap: mapped.cap || null,
    phone: mapped.phone || null,
    firstAidFlag: mapped.firstAidFlag ? parseBool(mapped.firstAidFlag) : false,
    maritalStatus,
    contractType,
    probationMonths: mapped.probationMonths ? parseInt(mapped.probationMonths, 10) || null : null,
    terminationDate: parseExcelDate(data['Termination Date'] ?? data['termination date'] ?? mapped.terminationDate) || null,
    terminationType,
  };

  if (companyId) payload.companyId = companyId;

  try {
    const emp = await createEmployee(payload as Parameters<typeof createEmployee>[0]);
    return { rowIndex, success: true, employee: emp };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (err instanceof Error ? err.message : 'Unknown error');
    return { rowIndex, success: false, error: msg };
  }
}
