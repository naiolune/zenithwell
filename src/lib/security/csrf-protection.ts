import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';

/**
 * CSRF Protection utility
 */
export class CSRFProtection {
  private static readonly CSRF_TOKEN_HEADER = 'x-csrf-token';
  private static readonly CSRF_COOKIE_NAME = 'csrf-token';

  /**
   * Generate a CSRF token
   */
  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a CSRF token hash
   */
  static createTokenHash(token: string, secret: string): string {
    return createHash('sha256')
      .update(token + secret)
      .digest('hex');
  }

  /**
   * Verify CSRF token
   */
  static verifyToken(request: NextRequest, secret: string): boolean {
    const token = request.headers.get(this.CSRF_TOKEN_HEADER);
    const cookieToken = request.cookies.get(this.CSRF_COOKIE_NAME)?.value;

    if (!token || !cookieToken) {
      return false;
    }

    // Verify the token matches the cookie
    return token === cookieToken;
  }

  /**
   * Check if request needs CSRF protection
   */
  static needsProtection(request: NextRequest): boolean {
    const method = request.method;
    const pathname = request.nextUrl.pathname;

    // Only protect state-changing methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return false;
    }

    // Skip protection for webhooks and public endpoints
    const skipPaths = [
      '/api/stripe/webhook',
      '/api/auth/callback',
      '/api/health'
    ];

    return !skipPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Validate CSRF token for request
   */
  static validateRequest(request: NextRequest): { valid: boolean; error?: string } {
    if (!this.needsProtection(request)) {
      return { valid: true };
    }

    const secret = process.env.CSRF_SECRET || 'default-csrf-secret';
    
    if (!this.verifyToken(request, secret)) {
      return { 
        valid: false, 
        error: 'Invalid CSRF token' 
      };
    }

    return { valid: true };
  }
}