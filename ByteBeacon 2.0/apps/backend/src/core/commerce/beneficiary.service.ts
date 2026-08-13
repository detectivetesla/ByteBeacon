import type pg from 'pg';
import {
  NetworkProvider,
  BeneficiaryValidationStatus,
  BeneficiaryValidationDto,
} from '@bytebeacon/shared';
import { BadRequestError } from '../errors/app-error.js';

export class BeneficiaryService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async validatePhoneNumber(
    phoneNumber: string,
    network: NetworkProvider,
  ): Promise<BeneficiaryValidationDto> {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');

    // Ghana phone format check (10 digits starting with 02/05 or +233)
    const ghanaPhoneRegex = /^(?:\+233|0)[235]\d{8}$/;
    if (!ghanaPhoneRegex.test(cleanPhone)) {
      throw new BadRequestError(
        'Invalid Ghana phone number format. Must be a valid 10-digit number (e.g. 024XXXXXXX).',
      );
    }

    // Check existing valid cache (valid for 30 days)
    const existingQuery = `
      SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
             provider_reference as "providerReference", validated_at as "validatedAt",
             expires_at as "expiresAt", created_at as "createdAt"
      FROM beneficiary_validation
      WHERE phone_number = $1 AND network = $2 AND validation_status = 'VALID' AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const cachedRes = await this.db.query(existingQuery, [cleanPhone, network]);
    if (cachedRes.rows.length > 0) {
      const r = cachedRes.rows[0];
      return {
        id: r.id,
        phoneNumber: r.phoneNumber,
        network: r.network as NetworkProvider,
        status: r.status as BeneficiaryValidationStatus,
        providerReference: r.providerReference,
        validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    }

    // Create new validation record (Valid for 30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const insertQuery = `
      INSERT INTO beneficiary_validation (phone_number, network, validation_status, validated_at, expires_at)
      VALUES ($1, $2, 'VALID', CURRENT_TIMESTAMP, $3)
      RETURNING id, phone_number as "phoneNumber", network, validation_status as "status",
                provider_reference as "providerReference", validated_at as "validatedAt",
                expires_at as "expiresAt", created_at as "createdAt"
    `;

    const result = await this.db.query(insertQuery, [cleanPhone, network, expiresAt]);
    const r = result.rows[0];

    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      network: r.network as NetworkProvider,
      status: r.status as BeneficiaryValidationStatus,
      providerReference: r.providerReference,
      validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  public async getBeneficiaryStatus(
    phoneNumber: string,
    network?: NetworkProvider,
  ): Promise<BeneficiaryValidationDto | null> {
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
    let query = `
      SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
             provider_reference as "providerReference", validated_at as "validatedAt",
             expires_at as "expiresAt", created_at as "createdAt"
      FROM beneficiary_validation
      WHERE phone_number = $1
    `;
    const params: unknown[] = [cleanPhone];

    if (network) {
      query += ' AND network = $2';
      params.push(network);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;

    const r = result.rows[0];
    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      network: r.network as NetworkProvider,
      status: r.status as BeneficiaryValidationStatus,
      providerReference: r.providerReference,
      validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }
}
