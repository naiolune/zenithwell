import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'therapy_sessions' });

    if (tableError) {
      // Fallback: try to describe the table structure
      const { data: sessions, error: sessionsError } = await supabase
        .from('therapy_sessions')
        .select('*')
        .limit(1);

      if (sessionsError) {
        return NextResponse.json({ 
          error: 'Cannot access therapy_sessions table',
          details: sessionsError.message 
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        table_structure: 'RPC not available, using sample data',
        sample_session: sessions[0] || null,
        columns: sessions[0] ? Object.keys(sessions[0]) : [],
        has_session_type: sessions[0] ? 'session_type' in sessions[0] : false
      });
    }

    return NextResponse.json({
      success: true,
      table_structure: tableInfo,
      has_session_type: tableInfo?.some((col: any) => col.column_name === 'session_type') || false
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Schema debug failed',
      details: error.message 
    }, { status: 500 });
  }
}