export enum Environment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum NetworkProvider {
  MTN = 'MTN',
  TELECEL = 'TELECEL',
  AIRTELTIGO = 'AIRTELTIGO',
}

export enum Currency {
  GHS = 'GHS',
  USD = 'USD',
}

export enum SecurityDomain {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  PROVIDER = 'PROVIDER',
  INTERNAL_WORKER = 'INTERNAL_WORKER',
}

export enum UserRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum ApiKeyEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum Permission {
  ORDERS_READ = 'orders.read',
  ORDERS_CREATE = 'orders.create',
  ORDERS_REFUND = 'orders.refund',
  ORDERS_RECONCILE = 'orders.reconcile',
  WALLET_READ = 'wallet.read',
  AGENTS_READ = 'agents.read',
  AGENTS_SUSPEND = 'agents.suspend',
  API_KEYS_MANAGE = 'api_keys.manage',
  AUDIT_READ = 'audit.read',
  SETTINGS_MANAGE = 'settings.manage',
}

export enum RateLimitTier {
  TIER_PUBLIC = 'TIER_PUBLIC',
  TIER_CUSTOMER = 'TIER_CUSTOMER',
  TIER_AGENT = 'TIER_AGENT',
  TIER_ADMIN = 'TIER_ADMIN',
}

// --- 4 Independent Status Dimensions (Phase 3 Core Invariant) ---

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  READY_FOR_FULFILLMENT = 'READY_FOR_FULFILLMENT',
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ProviderStatus {
  UNKNOWN = 'UNKNOWN',
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum RefundStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

// --- Beneficiary & Bulk Statuses ---

export enum BeneficiaryValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

export enum BulkSubmissionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum OrderEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_VALIDATED = 'ORDER_VALIDATED',
  ORDER_VALIDATION_FAILED = 'ORDER_VALIDATION_FAILED',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  ORDER_READY_FOR_FULFILLMENT = 'ORDER_READY_FOR_FULFILLMENT',
  ORDER_SUBMITTED = 'ORDER_SUBMITTED',
  PROVIDER_STATUS_UPDATED = 'PROVIDER_STATUS_UPDATED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_FAILED = 'ORDER_FAILED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
}
