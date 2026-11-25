import { describe, expect, it } from 'vitest';
import { orderCancelSchema, orderCreateSchema, orderQuerySchema } from './order';

const validOrder = {
  customerName: 'Ahmed Benali',
  customerPhone: '0550123456',
  dropoffWilayaCode: 16,
  dropoffAddressLine: '12 Rue Didouche Mourad',
  items: [{ name: 'Phone case', quantity: 2, unitPrice: 1500 }],
};

describe('orderCreateSchema', () => {
  it('accepts a valid order and trims fields', () => {
    const parsed = orderCreateSchema.parse({
      ...validOrder,
      customerName: '  Ahmed Benali  ',
      deliveryFee: 300,
      notes: '  call before arrival  ',
    });
    expect(parsed.customerName).toBe('Ahmed Benali');
    expect(parsed.notes).toBe('call before arrival');
    expect(parsed.deliveryFee).toBe(300);
  });

  it('requires at least one item', () => {
    const result = orderCreateSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid Algerian phone number', () => {
    const result = orderCreateSchema.safeParse({ ...validOrder, customerPhone: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative quantity or unit price', () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, items: [{ name: 'x', quantity: 0 }] }).success).toBe(false);
    expect(
      orderCreateSchema.safeParse({ ...validOrder, items: [{ name: 'x', quantity: 1, unitPrice: -5 }] }).success,
    ).toBe(false);
  });

  it('rejects a wilaya code outside 1..58', () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, dropoffWilayaCode: 99 }).success).toBe(false);
  });

  it('requires latitude and longitude together', () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, dropoffLatitude: 36.75 }).success).toBe(false);
    expect(
      orderCreateSchema.safeParse({ ...validOrder, dropoffLatitude: 36.75, dropoffLongitude: 3.06 }).success,
    ).toBe(true);
  });
});

describe('orderQuerySchema', () => {
  it('coerces page/pageSize from strings and applies defaults', () => {
    expect(orderQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(orderQuerySchema.parse({ page: '2', pageSize: '10' })).toEqual({ page: 2, pageSize: 10 });
  });

  it('rejects an unknown status filter', () => {
    expect(orderQuerySchema.safeParse({ status: 'flying' }).success).toBe(false);
  });
});

describe('orderCancelSchema', () => {
  it('allows an optional reason', () => {
    expect(orderCancelSchema.parse({})).toEqual({});
    expect(orderCancelSchema.parse({ reason: 'Customer changed mind' }).reason).toBe('Customer changed mind');
  });
});
