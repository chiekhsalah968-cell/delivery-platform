export const LOCALES = ['ar', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export const ROLES = ['customer', 'merchant', 'courier', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const VEHICLE_TYPES = ['motorcycle', 'car', 'truck'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const COURIER_AVAILABILITY = ['offline', 'online', 'busy'] as const;
export type CourierAvailability = (typeof COURIER_AVAILABILITY)[number];