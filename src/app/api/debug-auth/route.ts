import { NextRequest, NextResponse } from 'next/server';
import { AuthValidator } from '@/lib/security/auth-validator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No valid authorization header',
        authHeader: authHeader || 'null'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('Token length:', token.length);

    // Test Supabase auth directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('Supabase auth result:', { user: user?.id, error: authError?.message });

    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Invalid token',
        supabaseError: authError?.message
      }, { status: 401 });
    }

    // Test database access
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('user_id, email, subscription_tier, is_admin')
      .eq('user_id', user.id)
      .single();

    console.log('Database query result:', { userProfile, profileError });

    if (profileError) {
      return NextResponse.json({ 
        error: 'Database query failed',
        profileError: profileError.message
      }, { status: 500 });
    }

    // Test the auth validator
    const authResult = await AuthValidator.validateAuth(authHeader);
    console.log('Auth validator result:', authResult);

    return NextResponse.json({ 
      success: true,
      user: authResult.user,
      supabaseUser: user.id,
      databaseUser: userProfile,
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
