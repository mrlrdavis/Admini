import { getClient } from './getClient';
import type { AdminiRole } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'];
const REQUIRED_COLUMNS = ['name', 'email', 'role'] as const;
const VALID_ROLES: AdminiRole[] = ['admin', 'principal', 'teacher', 'staff'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RosterRow {
  name: string;
  email: string;
  role: AdminiRole;
  /** Original row index in the source file (1-based, excluding header). */
  rowIndex: number;
}

export interface RowError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface RosterParseResult {
  rows: RosterRow[];
  errors: RowError[];
  totalRows: number;
}

export interface ValidationResult {
  valid: RosterRow[];
  errors: RowError[];
}

export interface BulkAddResult {
  added: number;
  failed: Array<{ rowIndex: number; email: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RosterUploadError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'ROSTER_UPLOAD_ERROR') {
    super(message);
    this.name = 'RosterUploadError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function isValidRole(role: string): role is AdminiRole {
  return VALID_ROLES.includes(role as AdminiRole);
}

/**
 * Parse CSV text into rows of string arrays.
 * Handles quoted fields and newlines within quotes.
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  let currentRow: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    if (inQuotes) {
      currentField += '\n';
    } else {
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    }
  }

  // Flush any remaining data
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Find the column index for each required column by matching header names.
 */
function mapHeaders(
  headers: string[],
): { columnMap: Record<string, number>; missingColumns: string[] } {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const columnMap: Record<string, number> = {};
  const missingColumns: string[] = [];

  for (const col of REQUIRED_COLUMNS) {
    const idx = normalized.indexOf(col);
    if (idx === -1) {
      missingColumns.push(col);
    } else {
      columnMap[col] = idx;
    }
  }

  return { columnMap, missingColumns };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Parse a roster file (CSV or XLSX) into structured rows.
 * Validates file size and format before parsing.
 *
 * For XLSX files, uses a dynamic import of the `xlsx` library.
 * If xlsx is not available, throws an error suggesting CSV format.
 */
export async function parseRosterFile(file: File): Promise<RosterParseResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new RosterUploadError(
      `File size exceeds the maximum of 5MB. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
      'FILE_TOO_LARGE',
    );
  }

  // Validate file extension
  const ext = getFileExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new RosterUploadError(
      `Unsupported file format "${ext}". Accepted formats: .csv, .xlsx`,
      'INVALID_FORMAT',
    );
  }

  let dataRows: string[][];

  if (ext === '.csv') {
    const text = await file.text();
    dataRows = parseCsvText(text);
  } else {
    // .xlsx - attempt dynamic import
    try {
      // @ts-expect-error xlsx is an optional dependency for XLSX file support
      const XLSX = await (import('xlsx') as Promise<any>);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      dataRows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
      }) as string[][];
    } catch {
      throw new RosterUploadError(
        'Could not parse XLSX file. Please ensure the file is a valid Excel spreadsheet or use CSV format.',
        'XLSX_PARSE_ERROR',
      );
    }
  }

  if (dataRows.length < 2) {
    throw new RosterUploadError(
      'File must contain a header row and at least one data row.',
      'EMPTY_FILE',
    );
  }

  // Extract headers and map columns
  const headers = dataRows[0]!.map(String);
  const { columnMap, missingColumns } = mapHeaders(headers);

  if (missingColumns.length > 0) {
    throw new RosterUploadError(
      `Missing required columns: ${missingColumns.join(', ')}. Required: name, email, role`,
      'MISSING_COLUMNS',
    );
  }

  // At this point columnMap is guaranteed to have name, email, role keys
  const nameIdx = columnMap['name']!;
  const emailIdx = columnMap['email']!;
  const roleIdx = columnMap['role']!;

  // Parse data rows
  const rows: RosterRow[] = [];
  const errors: RowError[] = [];

  for (let i = 1; i < dataRows.length; i++) {
    const cells = dataRows[i]!.map(String);
    const rowIndex = i; // 1-based index relative to data (header is row 0)
    const name = (cells[nameIdx] || '').trim();
    const email = (cells[emailIdx] || '').trim();
    const roleRaw = (cells[roleIdx] || '').trim().toLowerCase();

    let hasError = false;

    if (!name) {
      errors.push({ rowIndex, field: 'name', message: 'Name is required' });
      hasError = true;
    }

    if (!email) {
      errors.push({ rowIndex, field: 'email', message: 'Email is required' });
      hasError = true;
    } else if (!isValidEmail(email)) {
      errors.push({ rowIndex, field: 'email', message: 'Invalid email format' });
      hasError = true;
    }

    if (!roleRaw) {
      errors.push({ rowIndex, field: 'role', message: 'Role is required' });
      hasError = true;
    } else if (!isValidRole(roleRaw)) {
      errors.push({
        rowIndex,
        field: 'role',
        message: `Invalid role "${roleRaw}". Valid roles: ${VALID_ROLES.join(', ')}`,
      });
      hasError = true;
    }

    if (!hasError) {
      rows.push({ name, email, role: roleRaw as AdminiRole, rowIndex });
    }
  }

  return {
    rows,
    errors,
    totalRows: dataRows.length - 1, // exclude header
  };
}

/**
 * Validate an array of roster rows for duplicates and data integrity.
 */
export function validateRosterRows(rows: RosterRow[]): ValidationResult {
  const valid: RosterRow[] = [];
  const errors: RowError[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const emailLower = row.email.toLowerCase();

    if (seenEmails.has(emailLower)) {
      errors.push({
        rowIndex: row.rowIndex,
        field: 'email',
        message: 'Duplicate email in upload',
      });
      continue;
    }

    seenEmails.add(emailLower);
    valid.push(row);
  }

  return { valid, errors };
}

/**
 * Bulk add validated roster members to an organization.
 * Creates invitations for each member to join the organization.
 * Persists each invitation individually to capture per-row successes and failures.
 */
export async function bulkAddMembers(
  organizationId: string,
  rows: RosterRow[],
): Promise<BulkAddResult> {
  const client = getClient();
  let added = 0;
  const failed: BulkAddResult['failed'] = [];

  for (const row of rows) {
    try {
      // Create an invitation for this roster member using the create_invitation RPC
      const { error } = await client.rpc('create_invitation', {
        target_organization_id: organizationId,
        invite_email: row.email,
        invite_role: row.role,
      });

      if (error) {
        // Check for duplicate invitation error
        if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          failed.push({ rowIndex: row.rowIndex, email: row.email, reason: 'Invitation already pending for this email' });
        } else {
          failed.push({ rowIndex: row.rowIndex, email: row.email, reason: error.message });
        }
      } else {
        added++;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      failed.push({ rowIndex: row.rowIndex, email: row.email, reason });
    }
  }

  return { added, failed };
}
