import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  InvalidOrderTransitionError,
  isTerminal,
  ORDER_STATUSES,
  type OrderStatus,
} from './status';

describe('order status machine', () => {
  it('allows the full happy path', () => {
    const path: OrderStatus[] = [
      'pending_dispatch',
      'offered',
      'accepted',
      'en_route_pickup',
      'picked_up',
      'en_route_dropoff',
      'delivered',
      'completed',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('allows dispatch retry loops', () => {
    expect(canTransition('offered', 'pending_dispatch')).toBe(true);
    expect(canTransition('unassigned', 'pending_dispatch')).toBe(true);
    expect(canTransition('accepted', 'pending_dispatch')).toBe(true);
  });

  it('rejects skipping pickup', () => {
    expect(canTransition('accepted', 'delivered')).toBe(false);
    expect(() => assertTransition('accepted', 'delivered')).toThrow(InvalidOrderTransitionError);
  });

  it('rejects transitions out of terminal states', () => {
    for (const terminal of ['completed', 'cancelled', 'failed_delivery'] as const) {
      expect(isTerminal(terminal)).toBe(true);
      for (const target of ORDER_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('rejects unknown statuses defensively', () => {
    expect(canTransition('pending_dispatch', 'flying' as OrderStatus)).toBe(false);
  });

  it('allows cancellation only before pickup', () => {
    expect(canTransition('pending_dispatch', 'cancelled')).toBe(true);
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('picked_up', 'cancelled')).toBe(false);
    expect(canTransition('en_route_dropoff', 'cancelled')).toBe(false);
  });
});