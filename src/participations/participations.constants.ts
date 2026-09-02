export const cryptoCurrencies = [
  'USDT',
  'BTC',
  'ETH',
  'TON',
  'TRX',
  'USDC',
  'LTC',
  'BNB',
] as const;

export type CryptoCurrency = (typeof cryptoCurrencies)[number];
