/**
 * Goals Management API Routes
 * Server-side only - handles all goal CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/middleware/api-security';
import { 
  getUserGoals, 
  addGoal, 
  updateGoalStatus, 
  deleteGoal,
  clearAllUserGoals 
} from '@/lib/ai/memory-service';

// GET /api/goals - Retrieve user goals
async function handleGet(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as 'active' | 'achieved' | 'paused' | 'all' || 'active';
    const status = statusParam === 'all' ? undefined : statusParam;

    const goals = await getUserGoals(user.id, status);

    return NextResponse.json({ 
      success: true, 
      data: goals 
    });
  } catch (error: any) {
    console.error('GET /api/goals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/goals - Add new goal
async function handlePost(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { goalText } = body;

    if (!goalText || goalText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Goal text is required' },
        { status: 400 }
      );
    }

    if (goalText.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Goal text too long (max 500 characters)' },
        { status: 400 }
      );
    }

    const goal = await addGoal(user.id, goalText.trim());

    return NextResponse.json({ 
      success: true, 
      data: goal 
    });
  } catch (error: any) {
    console.error('POST /api/goals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/goals - Update goal status
async function handlePut(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { goalId, status, achievedAt } = body;

    if (!goalId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: goalId, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['active', 'achieved', 'paused'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Verify ownership before updating
    const existingGoals = await getUserGoals(user.id);
    const goalExists = existingGoals.some(g => g.id === goalId);
    
    if (!goalExists) {
      return NextResponse.json(
        { success: false, error: 'Goal not found or access denied' },
        { status: 404 }
      );
    }

    const goal = await updateGoalStatus(
      goalId, 
      status, 
      achievedAt || (status === 'achieved' ? new Date().toISOString() : undefined)
    );

    return NextResponse.json({ 
      success: true, 
      data: goal 
    });
  } catch (error: any) {
    console.error('PUT /api/goals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/goals - Delete goal
async function handleDelete(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { goalId, clearAll } = body;

    if (clearAll) {
      // Clear all user goals
      await clearAllUserGoals(user.id);
      return NextResponse.json({ 
        success: true, 
        message: 'All goals cleared' 
      });
    }

    if (!goalId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: goalId' },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const existingGoals = await getUserGoals(user.id);
    const goalExists = existingGoals.some(g => g.id === goalId);
    
    if (!goalExists) {
      return NextResponse.json(
        { success: false, error: 'Goal not found or access denied' },
        { status: 404 }
      );
    }

    await deleteGoal(goalId);

    return NextResponse.json({ 
      success: true, 
      message: 'Goal deleted' 
    });
  } catch (error: any) {
    console.error('DELETE /api/goals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Main handler with security middleware
export const GET = withAPISecurity(handleGet, {
  requireAuth: true,
  rateLimitType: 'general_api'
});

export const POST = withAPISecurity(handlePost, {
  requireAuth: true,
  rateLimitType: 'general_api'
});

export const PUT = withAPISecurity(handlePut, {
  requireAuth: true,
  rateLimitType: 'general_api'
});

export const DELETE = withAPISecurity(handleDelete, {
  requireAuth: true,
  rateLimitType: 'general_api'
});
