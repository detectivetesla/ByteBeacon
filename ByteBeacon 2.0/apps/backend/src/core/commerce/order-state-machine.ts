import { OrderStatus } from '@bytebeacon/shared';
import { BadRequestError } from '../errors/app-error.js';

export class OrderStateMachine {
  // Explicit valid state transitions
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.CREATED]: [
      OrderStatus.VALIDATING,
      OrderStatus.READY_FOR_FULFILLMENT,
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.VALIDATING]: [
      OrderStatus.READY_FOR_FULFILLMENT,
      OrderStatus.FAILED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.READY_FOR_FULFILLMENT]: [
      OrderStatus.SUBMITTED,
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.SUBMITTED]: [
      OrderStatus.PROCESSING,
      OrderStatus.COMPLETED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.PROCESSING]: [
      OrderStatus.COMPLETED,
      OrderStatus.FAILED,
    ],
    // Terminal States (No outward transitions)
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.FAILED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  public static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static validateTransition(from: OrderStatus, to: OrderStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestError(
        `Invalid order status transition: Cannot transition from '${from}' to '${to}'`,
      );
    }
  }

  public static isTerminal(status: OrderStatus): boolean {
    return (
      status === OrderStatus.COMPLETED ||
      status === OrderStatus.FAILED ||
      status === OrderStatus.CANCELLED
    );
  }
}
