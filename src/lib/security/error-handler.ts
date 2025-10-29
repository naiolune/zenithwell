import { NextResponse } from 'next/server';

/**
 * Secure error handling utility
 */
export class SecureErrorHandler {
  /**
   * Handle API errors securely without exposing internal details
   */
  static handleAPIError(error: any, context?: string): NextResponse {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

    // Don't expose internal error details
    const safeError = this.sanitizeError(error);
    
    return NextResponse.json(
      { 
        error: safeError.message,
        ...(process.env.NODE_ENV === 'development' && { 
          details: safeError.details 
        })
      },
      { status: safeError.status }
    );
  }

  /**
   * Sanitize error to prevent information disclosure
   */
  private static sanitizeError(error: any): { message: string; status: number; details?: any } {
    // Database errors
    if (error?.code?.startsWith('PGRST') || error?.code?.startsWith('235')) {
      return {
        message: 'Database operation failed',
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }

    // Authentication errors
    if (error?.message?.includes('auth') || error?.message?.includes('token')) {
      return {
        message: 'Authentication failed',
        status: 401,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }

    // Validation errors
    if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
      return {
        message: 'Invalid request data',
        status: 400,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }

    // Rate limiting errors
    if (error?.message?.includes('rate limit') || error?.message?.includes('too many')) {
      return {
        message: 'Too many requests',
        status: 429,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }

    // Permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('access denied')) {
      return {
        message: 'Access denied',
        status: 403,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }

    // Generic server error
    return {
      message: 'Internal server error',
      status: 500,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(message: string): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(message: string = 'Authentication required'): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }

  /**
   * Handle authorization errors
   */
  static handleAuthzError(message: string = 'Access denied'): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 403 }
    );
  }

  /**
   * Handle not found errors
   */
  static handleNotFoundError(message: string = 'Resource not found'): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 404 }
    );
  }

  /**
   * Handle rate limit errors
   */
  static handleRateLimitError(retryAfter?: number): NextResponse {
    const headers: Record<string, string> = {};
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString();
    }

    return NextResponse.json(
      { 
        error: 'Too many requests',
        retryAfter: retryAfter || 60
      },
      { 
        status: 429,
        headers
      }
    );
  }
}