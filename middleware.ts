import { updateSession } from './src/lib/supabase/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { addSecurityHeaders } from './src/middleware/security-headers'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  
  // Add security headers to all responses
  if (response instanceof NextResponse) {
    return addSecurityHeaders(response)
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
