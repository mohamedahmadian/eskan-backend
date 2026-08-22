import * as ExcelJS from 'exceljs';

/** Brand teal-500 — matches frontend `--color-teal-500`. */
export const EXCEL_HEADER_FILL_ARGB = 'FF2EBDB6';
export const EXCEL_ROW_HEIGHT = 30;
export const EXCEL_FONT_SIZE = 12;
export const EXCEL_ROW_NO_KEY = 'rowNo';
export const EXCEL_ROW_NO_HEADER = 'ردیف';

export type ExcelExportColumn = {
  header: string;
  key: string;
  width?: number;
};

const headerFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: EXCEL_HEADER_FILL_ARGB },
};

const headerFont: Partial<ExcelJS.Font> = {
  bold: true,
  size: EXCEL_FONT_SIZE,
  color: { argb: 'FFFFFFFF' },
};

const bodyFont: Partial<ExcelJS.Font> = { size: EXCEL_FONT_SIZE };

const centerMiddle: Partial<ExcelJS.Alignment> = {
  vertical: 'middle',
  horizontal: 'center',
};

function paintHeaderStyle(row: ExcelJS.Row, columnCount: number) {
  row.height = EXCEL_ROW_HEIGHT;
  row.font = headerFont;
  row.alignment = centerMiddle;
  for (let col = 1; col <= columnCount; col += 1) {
    row.getCell(col).fill = headerFill;
  }
}

/**
 * Builds a standard list-export workbook:
 * teal header, row counter, font 12, row height 30, total footer row.
 */
export async function buildStyledExcelExport(options: {
  sheetName: string;
  columns: ExcelExportColumn[];
  rows: Array<Record<string, ExcelJS.CellValue>>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'اسکان';
  const sheet = workbook.addWorksheet(options.sheetName, {
    views: [{ rightToLeft: true }],
  });

  const dataColumns = options.columns;
  const columnCount = dataColumns.length + 1;

  sheet.columns = [
    { header: EXCEL_ROW_NO_HEADER, key: EXCEL_ROW_NO_KEY, width: 8 },
    ...dataColumns,
  ];

  paintHeaderStyle(sheet.getRow(1), columnCount);

  options.rows.forEach((data, index) => {
    const row = sheet.addRow({
      [EXCEL_ROW_NO_KEY]: index + 1,
      ...data,
    });
    row.height = EXCEL_ROW_HEIGHT;
    row.font = bodyFont;
    row.alignment = { vertical: 'middle' };
    row.getCell(EXCEL_ROW_NO_KEY).alignment = centerMiddle;
  });

  const totalRow = sheet.addRow({ [EXCEL_ROW_NO_KEY]: options.rows.length });
  paintHeaderStyle(totalRow, columnCount);
  for (let col = 2; col <= columnCount; col += 1) {
    totalRow.getCell(col).value = null;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
