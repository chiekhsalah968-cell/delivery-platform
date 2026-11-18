import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

const ISSUER = 'Delivery Platform Admin';

/** TOTP (RFC 6238) helpers for admin two-factor authentication. */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /** otpauth:// URI rendered as a QR code by the admin apps during enrollment. */
  keyuri(account: string, secret: string): string {
    return authenticator.keyuri(account, ISSUER, secret);
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }
}