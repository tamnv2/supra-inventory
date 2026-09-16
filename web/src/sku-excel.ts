import { readSheet } from "read-excel-file/browser";

export interface ParsedSkuItem {
  sku: string;
  product_name: string;
}

export interface ParsedSkuConflictCandidate {
  product_name: string;
  rows: number[];
}

export interface ParsedSkuConflict {
  sku: string;
  candidates: ParsedSkuConflictCandidate[];
}

export interface ParsedSkuWorkbook {
  items: ParsedSkuItem[];
  conflicts: ParsedSkuConflict[];
  source_hash: string;
  total_data_rows: number;
  header_row: number;
  sku_header: string;
  product_name_header: string;
  skipped_blank_rows: number;
  merged_duplicate_rows: number;
}

const MAX_DATA_ROWS = 50_000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const HEADER_SCAN_ROWS = 20;

function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error("SKU dạng số vượt giới hạn chính xác của trình duyệt. Hãy định dạng cột SKU thành Text trong Excel rồi tải lại.");
    }
    return String(value);
  }
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SKU_HEADERS = new Set(["sku", "ma sku", "sku code", "item sku", "ma hang"]);
const PRODUCT_HEADERS = new Set(["ten san pham", "ten sp", "product name", "ten hang", "san pham"]);

function findHeader(rows: unknown[][]): { rowIndex: number; skuIndex: number; nameIndex: number } | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SCAN_ROWS); rowIndex += 1) {
    let skuIndex = -1;
    let nameIndex = -1;
    for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      const header = normalizeHeader(rows[rowIndex][columnIndex]);
      if (SKU_HEADERS.has(header)) skuIndex = columnIndex;
      if (PRODUCT_HEADERS.has(header)) nameIndex = columnIndex;
    }
    if (skuIndex >= 0 && nameIndex >= 0 && skuIndex !== nameIndex) return { rowIndex, skuIndex, nameIndex };
  }
  return null;
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseSkuExcel(file: File): Promise<ParsedSkuWorkbook> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file Excel .xlsx.");
  if (file.size > MAX_FILE_BYTES) throw new Error("File Excel vượt quá 50 MB. Hãy tách file hoặc loại các cột không phục vụ SKU/Tên sản phẩm.");

  const [rows, sourceHash] = await Promise.all([readSheet(file) as Promise<unknown[][]>, sha256File(file)]);
  if (!rows.length) throw new Error("File Excel không có dữ liệu.");

  const header = findHeader(rows);
  if (!header) throw new Error("Không tìm thấy đủ cột SKU và Tên sản phẩm trong 20 dòng đầu.");

  const variants = new Map<string, Map<string, number[]>>();
  const invalidRows: string[] = [];
  let skippedBlankRows = 0;
  let totalDataRows = 0;

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    let sku = "";
    let productName = "";
    try {
      sku = text(rows[rowIndex][header.skuIndex]);
      productName = text(rows[rowIndex][header.nameIndex]).replace(/\s+/g, " ");
    } catch (error) {
      invalidRows.push(`Dòng ${rowIndex + 1}: ${error instanceof Error ? error.message : "SKU không hợp lệ"}`);
      continue;
    }
    if (!sku && !productName) {
      skippedBlankRows += 1;
      continue;
    }
    totalDataRows += 1;
    if (totalDataRows > MAX_DATA_ROWS) {
      throw new Error(`File vượt quá ${MAX_DATA_ROWS.toLocaleString("vi-VN")} dòng dữ liệu. Giới hạn này bảo vệ trình duyệt; file 10.000–50.000 dòng được hỗ trợ.`);
    }
    if (!sku || !productName) {
      invalidRows.push(`Dòng ${rowIndex + 1}: thiếu ${!sku ? "SKU" : "Tên sản phẩm"}.`);
      continue;
    }
    if (sku.length > 128) {
      invalidRows.push(`Dòng ${rowIndex + 1}: SKU quá dài.`);
      continue;
    }
    if (productName.length > 500) {
      invalidRows.push(`Dòng ${rowIndex + 1}: Tên sản phẩm quá dài.`);
      continue;
    }

    let names = variants.get(sku);
    if (!names) {
      names = new Map<string, number[]>();
      variants.set(sku, names);
    }
    const rowNumbers = names.get(productName) || [];
    rowNumbers.push(rowIndex + 1);
    names.set(productName, rowNumbers);
  }

  if (invalidRows.length) {
    const sample = invalidRows.slice(0, 100).join("\n");
    const suffix = invalidRows.length > 100 ? `\n... còn ${invalidRows.length - 100} dòng lỗi khác.` : "";
    throw new Error(`Có ${invalidRows.length} dòng dữ liệu không hợp lệ:\n${sample}${suffix}`);
  }

  const items: ParsedSkuItem[] = [];
  const conflicts: ParsedSkuConflict[] = [];
  let mergedDuplicateRows = 0;

  for (const [sku, names] of variants) {
    const candidates = [...names.entries()].map(([product_name, rowNumbers]) => ({ product_name, rows: rowNumbers }));
    const totalOccurrences = candidates.reduce((sum, candidate) => sum + candidate.rows.length, 0);
    mergedDuplicateRows += Math.max(0, totalOccurrences - candidates.length);
    if (candidates.length === 1) {
      items.push({ sku, product_name: candidates[0].product_name });
    } else {
      conflicts.push({ sku, candidates });
    }
  }

  if (!items.length && !conflicts.length) throw new Error("Không có SKU hợp lệ sau dòng tiêu đề.");

  return {
    items,
    conflicts,
    source_hash: sourceHash,
    total_data_rows: totalDataRows,
    header_row: header.rowIndex + 1,
    sku_header: text(rows[header.rowIndex][header.skuIndex]),
    product_name_header: text(rows[header.rowIndex][header.nameIndex]),
    skipped_blank_rows: skippedBlankRows,
    merged_duplicate_rows: mergedDuplicateRows,
  };
}
