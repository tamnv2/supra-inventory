import { readSheet } from "read-excel-file/universal";

export interface ParsedSkuItem {
  sku: string;
  product_name: string;
}

export interface ParsedSkuWorkbook {
  items: ParsedSkuItem[];
  header_row: number;
  sku_header: string;
  product_name_header: string;
  skipped_blank_rows: number;
  merged_duplicate_rows: number;
}

const MAX_ROWS = 5000;
const HEADER_SCAN_ROWS = 20;

function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
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

export async function parseSkuExcel(file: File): Promise<ParsedSkuWorkbook> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file Excel .xlsx.");
  if (file.size > 15 * 1024 * 1024) throw new Error("File Excel vượt quá 15 MB.");

  const rows = (await readSheet(file)) as unknown[][];
  if (!rows.length) throw new Error("File Excel không có dữ liệu.");

  const header = findHeader(rows);
  if (!header) throw new Error("Không tìm thấy đủ cột SKU và Tên sản phẩm trong 20 dòng đầu.");

  const bySku = new Map<string, { product_name: string; firstRow: number }>();
  let skippedBlankRows = 0;
  let mergedDuplicateRows = 0;
  let validDataRows = 0;

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const sku = text(rows[rowIndex][header.skuIndex]);
    const productName = text(rows[rowIndex][header.nameIndex]).replace(/\s+/g, " ");
    if (!sku && !productName) {
      skippedBlankRows += 1;
      continue;
    }
    validDataRows += 1;
    if (validDataRows > MAX_ROWS) throw new Error(`File vượt quá ${MAX_ROWS} dòng dữ liệu cho một lần nhập.`);
    if (!sku || !productName) throw new Error(`Dòng ${rowIndex + 1} thiếu SKU hoặc Tên sản phẩm.`);
    if (sku.length > 128) throw new Error(`Dòng ${rowIndex + 1}: SKU quá dài.`);
    if (productName.length > 500) throw new Error(`Dòng ${rowIndex + 1}: Tên sản phẩm quá dài.`);

    const previous = bySku.get(sku);
    if (!previous) {
      bySku.set(sku, { product_name: productName, firstRow: rowIndex + 1 });
      continue;
    }
    if (previous.product_name !== productName) {
      throw new Error(`SKU ${sku} có nhiều tên khác nhau tại dòng ${previous.firstRow} và ${rowIndex + 1}. Hãy xử lý xung đột trước khi nhập.`);
    }
    mergedDuplicateRows += 1;
  }

  const items = [...bySku.entries()].map(([sku, value]) => ({ sku, product_name: value.product_name }));
  if (!items.length) throw new Error("Không có SKU hợp lệ sau dòng tiêu đề.");

  return {
    items,
    header_row: header.rowIndex + 1,
    sku_header: text(rows[header.rowIndex][header.skuIndex]),
    product_name_header: text(rows[header.rowIndex][header.nameIndex]),
    skipped_blank_rows: skippedBlankRows,
    merged_duplicate_rows: mergedDuplicateRows,
  };
}
