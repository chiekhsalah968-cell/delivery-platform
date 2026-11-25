'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderStatus, Role } from '@delivery/shared';
import { api } from '@/lib/client-api';

export interface OrderGeoRef {
  code?: number;
  id?: string;
  nameAr: string;
  nameFr: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
}

export interface OrderStatusEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; role: Role } | null;
}

/** Serialized order as returned by the API. */
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: 'cod';
  merchantProfileId: string;
  customerUserId: string | null;
  pickupBusinessName: string;
  pickupWilayaCode: number;
  pickupMunicipalityId: string | null;
  pickupAddressLine: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  customerName: string;
  customerPhone: string;
  dropoffWilayaCode: number;
  dropoffMunicipalityId: string | null;
  dropoffAddressLine: string;
  dropoffLatitude: number | null;
  dropoffLongitude: number | null;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  statusEvents: OrderStatusEvent[];
  pickupWilaya: OrderGeoRef;
  pickupMunicipality: OrderGeoRef | null;
  dropoffWilaya: OrderGeoRef;
  dropoffMunicipality: OrderGeoRef | null;
  merchantProfile: { id: string; businessName: string };
}

export interface OrderList {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export function useOrders(status?: OrderStatus | '') {
  const [data, setData] = useState<OrderList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const query = status ? `?status=${status}` : '';
    const res = await api<OrderList>('GET', `orders${query}`);
    if (res.ok && res.data) {
      setData(res.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<Order>('GET', `orders/${id}`);
    if (res.ok && res.data) {
      setOrder(res.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { order, loading, error, refresh };
}
