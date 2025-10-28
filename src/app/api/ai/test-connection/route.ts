import { NextRequest, NextResponse } from 'next/server';
import { ServerAIService } from '@/lib/ai/server-ai-service';
import { withAPISecurity, SecurityConfigs, SecurityContext } from '@/middleware/api-security';

async function handleTestConnectionRequest(request: NextRequest, context: SecurityContext): Promise<NextResponse> {
  try {
    const { provider, apiKey, model } = await request.json();

    if (!context.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!context.user.isAdmin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    // Use the server AI service for testing
    const testResult = await ServerAIService.testConnection(provider, apiKey, model);

    return NextResponse.json({ 
      success: testResult.success, 
      error: testResult.error || (testResult.success ? null : 'Connection test failed')
    });

  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// Export the secured handler
export const POST = withAPISecurity(handleTestConnectionRequest, SecurityConfigs.ADMIN);
