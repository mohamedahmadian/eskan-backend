export const ITEM_QUOTA_VOUCHER_KIND = 1;
export const ICE_VOUCHER_KIND = 2;

export function voucherCodePrefix(year: number, kind: number) {
  return `${year}-${kind}-`;
}

export function nextSequentialVoucherCode(
  year: number,
  kind: number,
  codes: string[],
) {
  const prefix = voucherCodePrefix(year, kind);
  let max = 0;
  for (const code of codes) {
    if (!code.startsWith(prefix)) {
      continue;
    }
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      max = Math.max(max, Number(suffix));
    }
  }
  return `${prefix}${max + 1}`;
}
