export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty123',
  'bytebeacon',
  'bytebeacon123',
  'admin1234',
  'letmein123',
]);

export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  public static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    if (password && password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common or easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
