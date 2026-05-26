export interface ShippingRate {
  carrier: string;
  service: string;
  rate: number; // NGN
  currency: 'NGN';
  estimatedDays: string;
}

const WEST_AFRICA = ['GH', 'SN', 'CI', 'CM', 'BJ', 'TG', 'NE', 'BF', 'ML', 'GN', 'SL', 'LR', 'GW', 'GM', 'CV', 'MR'];
const EAST_AFRICA = ['KE', 'TZ', 'UG', 'RW', 'ET', 'SO', 'DJ', 'ER', 'SS', 'SD'];
const NORTH_AFRICA = ['EG', 'LY', 'TN', 'DZ', 'MA'];
const SOUTHERN_AFRICA = ['ZA', 'ZW', 'ZM', 'BW', 'NA', 'MZ', 'MW', 'LS', 'SZ', 'AO', 'MG', 'MU', 'SC'];
const CENTRAL_AFRICA = ['CD', 'CG', 'CF', 'GA', 'GQ', 'ST'];
const EUROPE = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PT', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'PL', 'IE', 'CZ', 'RO', 'HU', 'GR'];
const AMERICAS = ['US', 'CA', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY'];
const ASIA_PACIFIC = ['CN', 'JP', 'IN', 'AU', 'NZ', 'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'KR', 'HK', 'TW'];
const MIDDLE_EAST = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL', 'TR'];

const RATE_BY_REGION: Record<string, { rate: number; estimatedDays: string }> = {
  WEST_AFRICA:    { rate: 15000,  estimatedDays: '3-5 business days' },
  EAST_AFRICA:    { rate: 20000,  estimatedDays: '5-7 business days' },
  NORTH_AFRICA:   { rate: 20000,  estimatedDays: '5-7 business days' },
  SOUTHERN_AFRICA:{ rate: 22000,  estimatedDays: '5-7 business days' },
  CENTRAL_AFRICA: { rate: 20000,  estimatedDays: '5-7 business days' },
  MIDDLE_EAST:    { rate: 35000,  estimatedDays: '7-10 business days' },
  EUROPE:         { rate: 45000,  estimatedDays: '7-10 business days' },
  ASIA_PACIFIC:   { rate: 50000,  estimatedDays: '10-14 business days' },
  AMERICAS:       { rate: 55000,  estimatedDays: '10-14 business days' },
  DEFAULT:        { rate: 60000,  estimatedDays: '10-14 business days' },
};

function getRegion(country: string): string {
  if (WEST_AFRICA.includes(country))     return 'WEST_AFRICA';
  if (EAST_AFRICA.includes(country))     return 'EAST_AFRICA';
  if (NORTH_AFRICA.includes(country))    return 'NORTH_AFRICA';
  if (SOUTHERN_AFRICA.includes(country)) return 'SOUTHERN_AFRICA';
  if (CENTRAL_AFRICA.includes(country))  return 'CENTRAL_AFRICA';
  if (EUROPE.includes(country))          return 'EUROPE';
  if (AMERICAS.includes(country))        return 'AMERICAS';
  if (ASIA_PACIFIC.includes(country))    return 'ASIA_PACIFIC';
  if (MIDDLE_EAST.includes(country))     return 'MIDDLE_EAST';
  return 'DEFAULT';
}

export function getInternationalShippingRate(country: string): ShippingRate {
  const region = getRegion(country.toUpperCase());
  const { rate, estimatedDays } = (RATE_BY_REGION[region] || RATE_BY_REGION['DEFAULT'])!;
  return {
    carrier: 'DHL Express',
    service: 'International Shipping',
    rate,
    currency: 'NGN',
    estimatedDays,
  };
}

export function getShippingRates(country?: string): ShippingRate[] | object[] {
  if (country) {
    const c = country.toUpperCase();
    if (c === 'NG') {
      return [{
        carrier: 'Local Delivery',
        service: 'Distance-based delivery',
        rate: null,
        currency: 'NGN',
        estimatedDays: 'Same day – 2 days',
        note: 'Rate calculated at checkout based on delivery distance',
      }];
    }
    return [getInternationalShippingRate(c)];
  }

  return Object.entries(RATE_BY_REGION).map(([region, { rate, estimatedDays }]) => ({
    region,
    carrier: 'DHL Express',
    service: 'International Shipping',
    rate,
    currency: 'NGN',
    estimatedDays,
  }));
}
