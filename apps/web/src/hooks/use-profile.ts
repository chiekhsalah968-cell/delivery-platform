'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CourierAvailability, Role, VehicleType } from '@delivery/shared';
import { api } from '@/lib/client-api';

export interface GeoRef {
  code?: number;
  id?: string;
  nameAr: string;
  nameFr: string;
}

export interface CustomerProfile {
  id: string;
  fullName: string;
}

export interface MerchantProfile {
  id: string;
  businessName: string;
  description: string | null;
  wilayaCode: number;
  municipalityId: string | null;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  wilaya: GeoRef;
  municipality: GeoRef | null;
}

export interface CourierProfile {
  id: string;
  fullName: string;
  wilayaCode: number;
  municipalityId: string | null;
  availability: CourierAvailability;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
  wilaya: GeoRef;
  municipality: GeoRef | null;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  plateNumber: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  isDefault: boolean;
}

export interface Address {
  id: string;
  label: string;
  wilayaCode: number;
  municipalityId: string | null;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  wilaya: GeoRef;
  municipality: GeoRef | null;
}

export interface ProfileBundle {
  role: Role;
  customerProfile: CustomerProfile | null;
  merchantProfile: MerchantProfile | null;
  courierProfile: CourierProfile | null;
  vehicles: Vehicle[];
  addresses: Address[];
}

export function useProfile() {
  const [data, setData] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<ProfileBundle>('GET', 'profiles/me');
    if (res.ok && res.data) {
      setData(res.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export interface Wilaya {
  code: number;
  nameAr: string;
  nameFr: string;
}

export function useWilayas() {
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  useEffect(() => {
    let active = true;
    api<Wilaya[]>('GET', 'geo/wilayas').then((res) => {
      if (active && res.ok && res.data) setWilayas(res.data);
    });
    return () => {
      active = false;
    };
  }, []);
  return wilayas;
}

export interface Municipality {
  id: string;
  nameAr: string;
  nameFr: string;
  postalCode: string | null;
}

export function useMunicipalities(wilayaCode: number | null) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  useEffect(() => {
    if (!wilayaCode) {
      setMunicipalities([]);
      return;
    }
    let active = true;
    api<Municipality[]>('GET', `geo/wilayas/${wilayaCode}/municipalities`).then((res) => {
      if (active && res.ok && res.data) setMunicipalities(res.data);
    });
    return () => {
      active = false;
    };
  }, [wilayaCode]);
  return municipalities;
}