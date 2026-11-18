export const ORDER_STATUSES = [
  'pending_dispatch',
  'offered',
  'accepted',
  'en_route_pickup',
  'picked_up',
  'en_route_dropoff',
  'delivered',
  'completed',
  'unassigned',
  'cancelled',
  'failed_delivery',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_dispatch: ['offered', 'unassigned', 'cancelled'],
  offered: ['accepted', 'pending_dispatch', 'unassigned', 'cancelled'],
  accepted: ['en_route_pickup', 'pending_dispatch', 'cancelled'],
  en_route_pickup: ['picked_up', 'failed_delivery', 'cancelled'],
  picked_up: ['en_route_dropoff'],
  en_route_dropoff: ['delivered', 'failed_delivery'],
  delivered: ['completed'],
  completed: [],
  unassigned: ['pending_dispatch', 'cancelled'],
  cancelled: [],
  failed_delivery: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled', 'failed_delivery'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Invalid order transition: ${from} -> ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}