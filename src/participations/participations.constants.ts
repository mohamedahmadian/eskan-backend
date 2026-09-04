export const contributionTypes = ['CASH', 'IN_KIND'] as const;

export type ContributionTypeValue = (typeof contributionTypes)[number];

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
