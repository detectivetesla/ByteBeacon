import argon2 from 'argon2';
import { logger } from '../logging/logger.js';

export interface Argon2Options {
  memoryCost: number; // in KiB (e.g. 65536 = 64MB)
  timeCost: number; // iterations
  parallelism: number; // threads
}

// OWASP Recommended Default Options for Argon2id
export const DEFAULT_ARGON2_OPTIONS: Argon2Options = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export class PasswordHasher {
  private readonly options: Argon2Options;

  constructor(options: Argon2Options = DEFAULT_ARGON2_OPTIONS) {
    this.options = options;
  }

  /**
   * Hashes a plain password using Argon2id.
   * Passwords must NEVER be logged.
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: this.options.memoryCost,
        timeCost: this.options.timeCost,
        parallelism: this.options.parallelism,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to hash password');
      throw new Error('Password hashing error');
    }
  }

  /**
   * Verifies a plain password against an Argon2id hash.
   */
  public async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (err) {
      logger.error({ err }, 'Failed to verify password hash');
      return false;
    }
  }
}

export const defaultPasswordHasher = new PasswordHasher();
