import { z } from 'zod';
import { COURIER_AVAILABILITY, VEHICLE_TYPES } from './constants';

/** Algeria has 58 wilayas (codes 1..58). */
export const wilayaCodeSchema = z
  .number()
  .int('Wilaya code must be an integer')
  .min(1, 'Wilaya code must be between 1 and 58')
  .max(58, 'Wilaya code must be between 1 and 58');

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/** Optional coordinates: both must be present together or both absent. */
const coordinates = {
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
};

function refineCoordinates<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (value) => {
      const v = value as { latitude?: number; longitude?: number };
      return (v.latitude === undefined) === (v.longitude === undefined);
    },
    { message: 'Latitude and longitude must be provided together', path: ['latitude'] },
  );
}

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const customerProfileSchema = z.object({
  fullName: trimmed(120),
});
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;

export const merchantProfileSchema = refineCoordinates(
  z.object({
    businessName: trimmed(160),
    description: z.string().trim().max(1000).optional(),
    wilayaCode: wilayaCodeSchema,
    municipalityId: z.uuid().optional(),
    addressLine: trimmed(300),
    ...coordinates,
  }),
);
export type MerchantProfileInput = z.infer<typeof merchantProfileSchema>;

export const courierProfileSchema = refineCoordinates(
  z.object({
    fullName: trimmed(120),
    wilayaCode: wilayaCodeSchema,
    municipalityId: z.uuid().optional(),
    ...coordinates,
  }),
);
export type CourierProfileInput = z.infer<typeof courierProfileSchema>;

export const courierAvailabilitySchema = z.object({
  availability: z.enum(COURIER_AVAILABILITY),
});
export type CourierAvailabilityInput = z.infer<typeof courierAvailabilitySchema>;

/** Courier location heartbeat (used by dispatch / live tracking). */
export const courierLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
export type CourierLocationInput = z.infer<typeof courierLocationSchema>;

export const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  plateNumber: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .transform((value) => value.toUpperCase()),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  color: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const addressSchema = refineCoordinates(
  z.object({
    label: trimmed(80),
    wilayaCode: wilayaCodeSchema,
    municipalityId: z.uuid().optional(),
    addressLine: trimmed(300),
    ...coordinates,
    isDefault: z.boolean().optional(),
  }),
);
export type AddressInput = z.infer<typeof addressSchema>;

export const adminDecisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type AdminDecisionInput = z.infer<typeof adminDecisionSchema>;