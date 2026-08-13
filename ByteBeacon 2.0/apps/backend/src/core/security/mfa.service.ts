import crypto from 'node:crypto';

export class MfaService {
  private static readonly BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  public static generateSecret(length = 20): string {
    const randomBytes = crypto.randomBytes(length);
    let secret = '';
    for (let i = 0; i < randomBytes.length; i++) {
      secret += this.BASE32_ALPHABET[randomBytes[i] % 32];
    }
    return secret;
  }

  public static generateOtpAuthUri(accountName: string, issuer: string, secret: string): string {
    const encodedAccount = encodeURIComponent(accountName);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  public static verifyCode(secret: string, code: string, windowSteps = 1): boolean {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return false;
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);

    for (let i = -windowSteps; i <= windowSteps; i++) {
      const generated = this.generateCodeForStep(secret, currentStep + i);
      if (crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(code))) {
        return true;
      }
    }

    return false;
  }

  public static generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const code = `${part1}-${part2}`;
      rawCodes.push(code);
      hashedCodes.push(crypto.createHash('sha256').update(code).digest('hex'));
    }

    return { rawCodes, hashedCodes };
  }

  private static generateCodeForStep(secret: string, step: number): string {
    const key = this.base32Decode(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(step));

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  private static base32Decode(input: string): Buffer {
    const cleaned = input.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleaned.length; i++) {
      const val = this.BASE32_ALPHABET.indexOf(cleaned[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
  }
}
