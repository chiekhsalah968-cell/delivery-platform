import { z } from 'zod';
import { dzPhoneSchema } from '../auth';
import { latitudeSchema, longitudeSchema, wilayaCodeSchema } from '../profiles';
import { ORDER_STATUSES } from './status';

/** Payment methods supported today. Cash on delivery only for the first release. */
export const PAYMENT_METHODS = ['cod'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

/** Upper bound for a single monetary field, in whole dinars. */
const DZD_MAX = 100_000_000;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/** Free-form order line. Unit price is optional; the line still counts for tracking. */
export const orderItemSchema = z.object({
  name: trimmed(160),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0).max(DZD_MAX).optional(),
});
export type OrderItemInput = z.infer<typeof orderItemSchema>;

function bothOrNeitherDropoffCoordinates<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (value) => {
      const v = value as { dropoffLatitude?: number; dropoffLongitude?: number };
      return (v.dropoffLatitude === undefined) === (v.dropoffLongitude === undefined);
    },
    { message: 'Latitude and longitude must be provided together', path: ['dropoffLatitude'] },
  );
}

/**
 * Merchant creates a delivery order for goods going to a recipient. The pickup
 * is taken from the merchant's store profile on the server; the client only
 * supplies the recipient and dropoff details.
 */
export const orderCreateSchema = bothOrNeitherDropoffCoordinates(
  z.object({
    customerName: trimmed(120),
    customerPhone: dzPhoneSchema,
    dropoffWilayaCode: wilayaCodeSchema,
    dropoffMunicipalityId: z.uuid().optional(),
    dropoffAddressLine: trimmed(300),
    dropoffLatitude: latitudeSchema.optional(),
    dropoffLongitude: longitudeSchema.optional(),
    items: z.array(orderItemSchema).min(1, 'Add at least one item').max(50, 'Too many items'),
    deliveryFee: z.number().int().min(0).max(DZD_MAX).optional(),
    notes: optionalTrimmed(500),
  }),
);
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type OrderQuery = z.infer<typeof orderQuerySchema>;

export const orderCancelSchema = z.object({
  reason: optionalTrimmed(300),
});
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
