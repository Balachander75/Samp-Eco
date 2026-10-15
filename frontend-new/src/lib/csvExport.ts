/**
 * Enterprise CSV Export Utility.
 * Formats data according to RFC-4180 with UTF-8 BOM encoding for seamless Microsoft Excel compatibility.
 */

export interface CsvColumnDef<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

export interface ExportRecordsToCsvOptions<T> {
  filename: string;
  columns: CsvColumnDef<T>[];
  data: T[];
}

export interface ExportRawCsvOptions {
  filename: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // Double up any quotes and wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

function triggerDownload(csvContent: string, filename: string): void {
  // \uFEFF is the UTF-8 Byte Order Mark (BOM), required by Excel to open UTF-8 without garbled characters
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);

  const cleanFilename = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("download", cleanFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export typed data records to CSV using column accessors.
 */
export function exportRecordsToCsv<T>({ filename, columns, data }: ExportRecordsToCsvOptions<T>): boolean {
  if (!data || data.length === 0) {
    return false;
  }

  const headerRow = columns.map((col) => sanitizeCsvCell(col.header)).join(",");
  const dataRows = data.map((item) =>
    columns.map((col) => sanitizeCsvCell(col.accessor(item))).join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  triggerDownload(csvContent, filename);
  return true;
}

/**
 * Export raw header & row matrix to CSV.
 */
export function exportRawCsv({ filename, headers, rows }: ExportRawCsvOptions): boolean {
  if (!rows || rows.length === 0) {
    return false;
  }

  const headerRow = headers.map(sanitizeCsvCell).join(",");
  const dataRows = rows.map((row) => row.map(sanitizeCsvCell).join(","));

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  triggerDownload(csvContent, filename);
  return true;
}
