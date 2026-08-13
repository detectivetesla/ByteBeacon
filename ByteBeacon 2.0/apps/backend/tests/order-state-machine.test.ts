import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from '../src/core/commerce/order-state-machine.js';
import { OrderStatus } from '@bytebeacon/shared';

describe('Order State Machine Transition Engine', () => {
  it('should allow valid transitions according to state graph', () => {
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.VALIDATING)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.READY_FOR_FULFILLMENT)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.CANCELLED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.VALIDATING, OrderStatus.READY_FOR_FULFILLMENT)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.VALIDATING, OrderStatus.FAILED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.READY_FOR_FULFILLMENT, OrderStatus.SUBMITTED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.READY_FOR_FULFILLMENT, OrderStatus.CANCELLED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.PROCESSING)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.FAILED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.FAILED)).toBe(true);
  });

  it('should strictly reject illegal transitions', () => {
    // COMPLETED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.PROCESSING)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.FAILED)).toBe(false);

    // FAILED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.FAILED, OrderStatus.SUBMITTED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.FAILED, OrderStatus.COMPLETED)).toBe(false);

    // CANCELLED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.READY_FOR_FULFILLMENT)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.COMPLETED)).toBe(false);

    // Backward transitions
    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.VALIDATING)).toBe(false);
  });

  it('should throw BadRequestError when validateTransition is called with illegal transition', () => {
    expect(() =>
      OrderStateMachine.validateTransition(OrderStatus.COMPLETED, OrderStatus.PROCESSING),
    ).toThrow("Invalid order status transition: Cannot transition from 'COMPLETED' to 'PROCESSING'");
  });

  it('should correctly identify terminal states', () => {
    expect(OrderStateMachine.isTerminal(OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.FAILED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.CANCELLED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.isTerminal(OrderStatus.PROCESSING)).toBe(false);
  });
});
