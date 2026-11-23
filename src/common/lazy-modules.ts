let exceljs: Promise<typeof import('exceljs')> | undefined;
let jimp: Promise<typeof import('jimp')> | undefined;

export function loadExcelJS() {
  exceljs ??= import('exceljs').then((mod) => (mod.default ?? mod) as typeof import('exceljs'));
  return exceljs;
}

export function loadJimp() {
  jimp ??= import('jimp');
  return jimp;
}
