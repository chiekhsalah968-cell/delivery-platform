import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  courierAvailabilitySchema,
  courierLocationSchema,
  courierProfileSchema,
  customerProfileSchema,
  merchantProfileSchema,
  vehicleSchema,
  wilayaCodeSchema,
} from './profiles';

describe('wilayaCodeSchema', () => {
  it('accepts codes 1..58 and rejects out-of-range', () => {
    expect(wilayaCodeSchema.safeParse(1).success).toBe(true);
    expect(wilayaCodeSchema.safeParse(58).success).toBe(true);
    expect(wilayaCodeSchema.safeParse(0).success).toBe(false);
    expect(wilayaCodeSchema.safeParse(59).success).toBe(false);
    expect(wilayaCodeSchema.safeParse(16.5).success).toBe(false);
  });
});

describe('customerProfileSchema', () => {
  it('requires a non-empty fullName', () => {
    expect(customerProfileSchema.safeParse({ fullName: 'Amine B.' }).success).toBe(true);
    expect(customerProfileSchema.safeParse({ fullName: '   ' }).success).toBe(false);
  });
});

describe('merchantProfileSchema', () => {
  const base = { businessName: 'Épicerie El Baraka', wilayaCode: 16, addressLine: 'Rue Didouche' };

  it('accepts a minimal valid profile', () => {
    expect(merchantProfileSchema.safeParse(base).success).toBe(true);
  });

  it('accepts paired coordinates', () => {
    expect(
      merchantProfileSchema.safeParse({ ...base, latitude: 36.75, longitude: 3.06 }).success,
    ).toBe(true);
  });

  it('rejects unpaired or out-of-range coordinates', () => {
    expect(merchantProfileSchema.safeParse({ ...base, latitude: 36.75 }).success).toBe(false);
    expect(
      merchantProfileSchema.safeParse({ ...base, latitude: 91, longitude: 3.06 }).success,
    ).toBe(false);
  });

  it('rejects an invalid wilaya and empty business name', () => {
    expect(merchantProfileSchema.safeParse({ ...base, wilayaCode: 99 }).success).toBe(false);
    expect(merchantProfileSchema.safeParse({ ...base, businessName: '' }).success).toBe(false);
  });
});

describe('courierProfileSchema', () => {
  it('accepts a valid courier profile', () => {
    expect(courierProfileSchema.safeParse({ fullName: 'Karim', wilayaCode: 31 }).success).toBe(true);
  });
});

describe('courierAvailabilitySchema', () => {
  it('accepts known availability states only', () => {
    for (const availability of ['offline', 'online', 'busy']) {
      expect(courierAvailabilitySchema.safeParse({ availability }).success).toBe(true);
    }
    expect(courierAvailabilitySchema.safeParse({ availability: 'away' }).success).toBe(false);
  });
});

describe('courierLocationSchema', () => {
  it('requires both coordinates in range', () => {
    expect(courierLocationSchema.safeParse({ latitude: 36.7, longitude: 3.1 }).success).toBe(true);
    expect(courierLocationSchema.safeParse({ latitude: 36.7 }).success).toBe(false);
    expect(courierLocationSchema.safeParse({ latitude: 36.7, longitude: 200 }).success).toBe(false);
  });
});

describe('vehicleSchema', () => {
  const base = { type: 'motorcycle', plateNumber: '123456-116-16' };

  it('accepts valid vehicle types and uppercases the plate', () => {
    const parsed = vehicleSchema.safeParse({ ...base, plateNumber: 'abc-123' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.plateNumber).toBe('ABC-123');
    for (const type of ['motorcycle', 'car', 'truck']) {
      expect(vehicleSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });

  it('rejects unknown types and short plates', () => {
    expect(vehicleSchema.safeParse({ ...base, type: 'bike' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, plateNumber: 'ab' }).success).toBe(false);
  });
});

describe('addressSchema', () => {
  const base = { label: 'Home', wilayaCode: 16, addressLine: 'Cité 500 logts' };

  it('accepts a valid address', () => {
    expect(addressSchema.safeParse(base).success).toBe(true);
  });

  it('rejects unpaired coordinates', () => {
    expect(addressSchema.safeParse({ ...base, longitude: 3.06 }).success).toBe(false);
  });
});