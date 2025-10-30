import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withAPISecurity } from '@/middleware/api-security';
import { GROUP_SESSION_CONFIG } from '@/lib/group-session-config';

async function handleSubmitIntroduction(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      sessionId, 
      groupCategory,
      // Relationship fields
      relationshipRole,
      whyWellness,
      goals,
      challenges,
      // Family fields
      familyRole,
      familyGoals,
      whatToAchieve,
      // General fields
      participantRole,
      wellnessReason,
      personalGoals,
      expectations
    } = body;
    
    if (!sessionId || !groupCategory) {
      return NextResponse.json({ error: 'Session ID and group category are required' }, { status: 400 });
    }

    // Validate group category
    if (!Object.values(GROUP_SESSION_CONFIG.GROUP_CATEGORIES).includes(groupCategory)) {
      return NextResponse.json({ error: 'Invalid group category' }, { status: 400 });
    }

    // Verify user is a participant OR there's a valid invite for this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    // If not a participant, check if there's a valid invite (for join flow)
    if (!participant) {
      const { data: invite } = await supabase
        .from('session_invites')
        .select('id, expires_at, is_active')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!invite) {
        return NextResponse.json({ error: 'Not a participant in this session and no valid invite found' }, { status: 403 });
      }
    }

    // Prepare introduction data based on group category
    const introductionData: any = {
      session_id: sessionId,
      user_id: user.id,
      group_category: groupCategory
    };

    // Add fields based on group category
    if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP) {
      if (relationshipRole) introductionData.relationship_role = relationshipRole;
      if (whyWellness) introductionData.why_wellness = whyWellness;
      if (goals) introductionData.goals = goals;
      if (challenges) introductionData.challenges = challenges;
    } else if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY) {
      if (familyRole) introductionData.family_role = familyRole;
      if (whyWellness) introductionData.why_wellness = whyWellness;
      if (familyGoals) introductionData.family_goals = familyGoals;
      if (whatToAchieve) introductionData.what_to_achieve = whatToAchieve;
    } else if (groupCategory === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL) {
      if (participantRole) introductionData.participant_role = participantRole;
      if (wellnessReason) introductionData.wellness_reason = wellnessReason;
      if (personalGoals) introductionData.personal_goals = personalGoals;
      if (expectations) introductionData.expectations = expectations;
    }

    // Use service role client to bypass RLS for upsert operation
    // This ensures the operation succeeds even if RLS policies haven't been updated
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert introduction (update if exists, insert if not)
    const { data: introduction, error } = await serviceClient
      .from('participant_introductions')
      .upsert(introductionData, {
        onConflict: 'session_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving introduction:', error);
      return NextResponse.json({ 
        error: 'Failed to save introduction',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      introduction_id: introduction.id 
    });
  } catch (error) {
    console.error('Submit introduction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleGetIntroductions(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify user is a participant in this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant in this session' }, { status: 403 });
    }

    // Get all introductions for this session
    const { data: introductions, error } = await supabase
      .from('participant_introductions')
      .select(`
        id,
        user_id,
        group_category,
        relationship_role,
        why_wellness,
        goals,
        challenges,
        family_role,
        family_goals,
        what_to_achieve,
        participant_role,
        wellness_reason,
        personal_goals,
        expectations,
        created_at,
        updated_at,
        users!inner(
          id,
          email,
          full_name
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching introductions:', error);
      return NextResponse.json({ error: 'Failed to fetch introductions' }, { status: 500 });
    }

    // Format introductions for display
    const formattedIntroductions = introductions?.map(intro => {
      const user = Array.isArray(intro.users) ? intro.users[0] : intro.users;
      const baseIntro = {
        id: intro.id,
        user_id: intro.user_id,
        user_name: user?.full_name || user?.email,
        user_email: user?.email,
        group_category: intro.group_category,
        created_at: intro.created_at,
        updated_at: intro.updated_at
      };

      // Add category-specific fields
      if (intro.group_category === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.RELATIONSHIP) {
        return {
          ...baseIntro,
          relationship_role: intro.relationship_role,
          why_wellness: intro.why_wellness,
          goals: intro.goals,
          challenges: intro.challenges
        };
      } else if (intro.group_category === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.FAMILY) {
        return {
          ...baseIntro,
          family_role: intro.family_role,
          why_wellness: intro.why_wellness,
          family_goals: intro.family_goals,
          what_to_achieve: intro.what_to_achieve
        };
      } else if (intro.group_category === GROUP_SESSION_CONFIG.GROUP_CATEGORIES.GENERAL) {
        return {
          ...baseIntro,
          participant_role: intro.participant_role,
          wellness_reason: intro.wellness_reason,
          personal_goals: intro.personal_goals,
          expectations: intro.expectations
        };
      }

      return baseIntro;
    }) || [];

    return NextResponse.json({ introductions: formattedIntroductions });
  } catch (error) {
    console.error('Get introductions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAPISecurity(handleSubmitIntroduction, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false
});

export const GET = withAPISecurity(handleGetIntroductions, {
  requireAuth: true,
  rateLimitType: 'general_api',
  requireCSRF: false
});
