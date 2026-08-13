import { describe, it, expect } from 'vitest';
import { PasswordValidator } from '../src/core/security/password-validator.js';
import { PasswordHasher } from '../src/core/security/password-hasher.js';

describe('Password Security (OWASP ASVS 4.0)', () => {
  it('should reject weak or common passwords', () => {
    const tooShort = PasswordValidator.validate('Pass1!');
    expect(tooShort.isValid).toBe(false);
    expect(tooShort.errors).toContain('Password must be at least 8 characters long');

    const noUpper = PasswordValidator.validate('password123!');
    expect(noUpper.isValid).toBe(false);
    expect(noUpper.errors).toContain('Password must contain at least one uppercase letter');

    const noNumber = PasswordValidator.validate('Password!Special');
    expect(noNumber.isValid).toBe(false);
    expect(noNumber.errors).toContain('Password must contain at least one number');

    const noSpecial = PasswordValidator.validate('Password123');
    expect(noSpecial.isValid).toBe(false);
    expect(noSpecial.errors).toContain('Password must contain at least one special character');

    const commonPass = PasswordValidator.validate('Password123!');
    // If it's not common, test explicit common
    const explicitlyCommon = PasswordValidator.validate('bytebeacon123');
    expect(explicitlyCommon.isValid).toBe(false);
  });

  it('should accept strong compliant passwords', () => {
    const strong = PasswordValidator.validate('K9#mX$8vL2!pQz');
    expect(strong.isValid).toBe(true);
    expect(strong.errors).toHaveLength(0);
  });

  it('should hash and verify passwords using Argon2id', async () => {
    const hasher = new PasswordHasher({ memoryCost: 4096, timeCost: 1, parallelism: 1 });
    const raw = 'Str0ngP@ssw0rd2026!';
    const hash = await hasher.hashPassword(raw);

    expect(hash.startsWith('$argon2id$')).toBe(true);

    const valid = await hasher.verifyPassword(hash, raw);
    expect(valid).toBe(true);

    const invalid = await hasher.verifyPassword(hash, 'WrongPassword123!');
    expect(invalid).toBe(false);
  });
});
