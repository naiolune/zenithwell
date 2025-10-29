import { NextRequest, NextResponse } from 'next/server';
import { AuthValidator } from '@/lib/security/auth-validator';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { IPSecurity } from '@/lib/security/ip-security';
import { APILogger } from '@/lib/security/api-logger';
import { CSRFProtection } from '@/lib/security/csrf-protection';

export interface SecurityConfig {
  requireAuth: boolean;
  requireAdmin?: boolean;
  rateLimitType?: 'ai_call' | 'general_api';
  trackSuspiciousActivity?: boolean;
  allowedMethods?: readonly string[];
  requireCSRF?: boolean;
}

export interface SecurityContext {
  user?: {
    id: string;
    email: string;
    subscriptionTier: 'free' | 'pro';
    isAdmin: boolean;
  };
  ipAddress: string;
  userAgent?: string;
  startTime: number;
}

/**
 * Unified API security middleware that applies all security checks
 */
export function withAPISecurity(
  handler: (request: NextRequest, context: SecurityContext) => Promise<NextResponse>,
  config: SecurityConfig = { requireAuth: true }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    
    const context: SecurityContext = {
      ipAddress,
      userAgent,
      startTime,
    };

    try {
      // 1. Check if IP is blocked
      const ipBlockResult = await IPSecurity.isIPBlocked(ipAddress);
      if (ipBlockResult.isBlocked) {
        await APILogger.logRequest({
          endpoint: request.nextUrl.pathname,
          method: request.method,
          statusCode: 403,
          ipAddress,
          userAgent,
          responseTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          { 
            error: 'Access denied', 
            reason: ipBlockResult.reason,
            retryAfter: ipBlockResult.expiresAt ? 
              Math.ceil((ipBlockResult.expiresAt.getTime() - Date.now()) / 1000) : undefined
          },
          { 
            status: 403,
            headers: ipBlockResult.expiresAt ? {
              'Retry-After': Math.ceil((ipBlockResult.expiresAt.getTime() - Date.now()) / 1000).toString()
            } : {}
          }
        );
      }

      // 2. Check allowed methods
      if (config.allowedMethods && !config.allowedMethods.includes(request.method)) {
        await APILogger.logRequest({
          endpoint: request.nextUrl.pathname,
          method: request.method,
          statusCode: 405,
          ipAddress,
          userAgent,
          responseTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        );
      }

      // 3. CSRF Protection
      if (config.requireCSRF !== false) {
        const csrfValidation = CSRFProtection.validateRequest(request);
        if (!csrfValidation.valid) {
          await APILogger.logRequest({
            endpoint: request.nextUrl.pathname,
            method: request.method,
            statusCode: 403,
            ipAddress,
            userAgent,
            responseTimeMs: Date.now() - startTime,
          });

          return NextResponse.json(
            { error: csrfValidation.error || 'CSRF validation failed' },
            { status: 403 }
          );
        }
      }

      // 4. Track suspicious activity patterns
      if (config.trackSuspiciousActivity) {
        await IPSecurity.trackRapidRequests(ipAddress);
        await IPSecurity.trackUnusualEndpoints(ipAddress, request.nextUrl.pathname);
      }

      // 5. Authentication check
      if (config.requireAuth) {
        const authResult = await AuthValidator.validateAuth(
          request.headers.get('authorization')
        );

        if (!authResult.isValid) {
          // Track failed auth attempts
          await IPSecurity.trackFailedAuth(ipAddress);
          
          await APILogger.logRequest({
            userId: undefined,
            endpoint: request.nextUrl.pathname,
            method: request.method,
            statusCode: 401,
            ipAddress,
            userAgent,
            responseTimeMs: Date.now() - startTime,
          });

          return NextResponse.json(
            { 
              error: authResult.error,
              errorCode: authResult.errorCode 
            },
            { status: 401 }
          );
        }

        context.user = authResult.user;

        // 5. Admin check
        if (config.requireAdmin && !authResult.user!.isAdmin) {
          await APILogger.logRequest({
            userId: authResult.user!.id,
            endpoint: request.nextUrl.pathname,
            method: request.method,
            statusCode: 403,
            ipAddress,
            userAgent,
            responseTimeMs: Date.now() - startTime,
          });

          return NextResponse.json(
            { error: 'Admin privileges required' },
            { status: 403 }
          );
        }

        // 6. Rate limiting check
        if (config.rateLimitType) {
          const rateLimitResult = await RateLimiter.checkRateLimit(
            authResult.user!.id,
            config.rateLimitType,
            ipAddress
          );

          if (!rateLimitResult.allowed) {
            await APILogger.logRequest({
              userId: authResult.user!.id,
              endpoint: request.nextUrl.pathname,
              method: request.method,
              statusCode: 429,
              ipAddress,
              userAgent,
              responseTimeMs: Date.now() - startTime,
            });

            return NextResponse.json(
              { 
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter,
                resetTime: rateLimitResult.resetTime.toISOString()
              },
              { 
                status: 429,
                headers: {
                  'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
                  'X-RateLimit-Limit': config.rateLimitType === 'ai_call' ? '100' : '500',
                  'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                  'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
                }
              }
            );
          }
        }
      }

      // 7. Execute the actual handler
      const response = await handler(request, context);

      // 8. Increment rate limit counter if applicable
      if (config.rateLimitType && context.user) {
        await RateLimiter.incrementRateLimit(
          context.user.id,
          config.rateLimitType
        );
      }

      // 9. Log the request (async, non-blocking)
      const responseTime = Date.now() - startTime;
      APILogger.logRequest({
        userId: context.user?.id,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        statusCode: response.status,
        ipAddress,
        userAgent,
        responseTimeMs: responseTime,
      });

      return response;

    } catch (error) {
      console.error('API security middleware error:', error);
      
      // Log the error
      await APILogger.logRequest({
        userId: context.user?.id,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        statusCode: 500,
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  // Fallback to localhost
  return '127.0.0.1';
}

/**
 * Predefined security configurations for common use cases
 */
export const SecurityConfigs = {
  // AI chat endpoints - high security, rate limited
  AI_CHAT: {
    requireAuth: true,
    rateLimitType: 'ai_call' as const,
    trackSuspiciousActivity: true,
    allowedMethods: ['POST'],
    requireCSRF: false,
  },

  // General API endpoints - standard security
  GENERAL_API: {
    requireAuth: true,
    rateLimitType: 'general_api' as const,
    trackSuspiciousActivity: true,
    requireCSRF: false,
  },

  // Admin endpoints - admin only, no rate limiting
  ADMIN: {
    requireAuth: true,
    requireAdmin: true,
    trackSuspiciousActivity: true,
    requireCSRF: false,
  },

  // Public endpoints - no auth required
  PUBLIC: {
    requireAuth: false,
    trackSuspiciousActivity: true,
    requireCSRF: false,
  },

  // Webhook endpoints - no auth, but track activity
  WEBHOOK: {
    requireAuth: false,
    trackSuspiciousActivity: true,
    allowedMethods: ['POST'],
  },
} as const;
