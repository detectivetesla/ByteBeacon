import {
  UserRole,
  UserStatus,
  SecurityDomain,
  ApiKeyEnvironment,
  ApiKeyStatus,
  Permission,
  NetworkProvider,
  Currency,
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  BeneficiaryValidationStatus,
  BulkSubmissionStatus,
  OrderEventType,
} from '../enums/index.js';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorEnvelope;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Array<{
    field?: string;
    code: string;
    message: string;
  }>;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// --- Auth DTOs ---

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  identifier: string; // Email or phone
  password: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  securityDomain: SecurityDomain;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  walletBalancePesewas: number;
}

export interface AuthResponseData {
  user: UserSummaryDto;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PhoneVerificationRequest {
  code: string;
}

export interface ForgotPasswordRequest {
  emailOrPhone: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminMfaChallengeData {
  mfaRequired: true;
  mfaSessionToken: string;
}

export interface AdminMfaVerifyRequest {
  mfaSessionToken: string;
  totpCode: string;
}

export interface MfaSetupData {
  secret: string;
  qrUri: string;
  recoveryCodes: string[];
}

export interface CreateApiKeyRequest {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  expiresInDays?: number;
}

export interface ApiKeyCreatedDto {
  id: string;
  name: string;
  keyPrefix: string;
  apiKey: string; // Plaintext key returned ONCE at creation
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiKeySummaryDto {
  id: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// --- Commerce & Catalog DTOs ---

export interface CatalogProductDto {
  id: string;
  sku: string;
  network: NetworkProvider;
  name: string;
  dataAmountMb: number;
  validityDays: number;
  basePricePesewas: number;
  agentPricePesewas: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Order DTOs ---

export interface CreateOrderRequest {
  productId: string;
  recipientPhone: string;
  idempotencyKey?: string;
  agentId?: string;
}

export interface OrderPricingSnapshot {
  productId: string;
  sku: string;
  productName: string;
  network: NetworkProvider;
  dataAmountMb: number;
  unitPricePesewas: number;
  currency: Currency;
  snapshotTimestamp: string;
}

export interface ProviderOrderSummaryDto {
  providerName: string;
  providerReference: string | null;
  providerStatus: ProviderStatus;
  lastSyncedAt: string | null;
  lastProviderEventAt: string | null;
  syncVersion: number;
}

export interface OrderEventDto {
  id: string;
  eventType: OrderEventType;
  correlationId: string;
  actorId: string | null;
  actorType: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface OrderSummaryDto {
  id: string;
  publicId: string;
  userId: string;
  agentId: string | null;
  recipientPhone: string;
  network: NetworkProvider;
  dataAmountMb: number;
  amountPesewas: number;
  currency: Currency;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  providerStatus: ProviderStatus;
  refundStatus: RefundStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailsDto extends OrderSummaryDto {
  pricingSnapshot: OrderPricingSnapshot;
  providerOrder: ProviderOrderSummaryDto | null;
  events: OrderEventDto[];
}

// --- Beneficiary DTOs ---

export interface ValidateBeneficiaryRequest {
  phoneNumber: string;
  network: NetworkProvider;
}

export interface BeneficiaryValidationDto {
  id: string;
  phoneNumber: string;
  network: NetworkProvider;
  status: BeneficiaryValidationStatus;
  providerReference: string | null;
  validatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// --- Bulk Orders DTOs ---

export interface BulkSubmissionItemInput {
  recipientPhone: string;
  productId: string;
}

export interface CreateBulkSubmissionRequest {
  name: string;
  items: BulkSubmissionItemInput[];
  idempotencyKey?: string;
}

export interface BulkSubmissionItemDto {
  id: string;
  submissionId: string;
  orderId: string | null;
  recipientPhone: string;
  productId: string;
  amountPesewas: number;
  status: OrderStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface BulkSubmissionSummaryDto {
  id: string;
  userId: string;
  name: string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  totalAmountPesewas: number;
  status: BulkSubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BulkSubmissionDetailsDto extends BulkSubmissionSummaryDto {
  items: BulkSubmissionItemDto[];
}

// --- Agent DTOs ---

export interface ApplyAgentRequest {
  businessName: string;
  slug: string;
  experience?: string;
  reason?: string;
}

export interface AgentProfileDto {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
