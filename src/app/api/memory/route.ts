/**
 * Memory Management API Routes
 * Server-side only - handles all memory CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/middleware/api-security';
import { 
  getUserMemory, 
  addMemory, 
  updateMemory, 
  deleteMemory, 
  searchMemory,
  clearAllUserMemory 
} from '@/lib/ai/memory-service';
import { InputSanitizer } from '@/lib/security/input-sanitizer';

// GET /api/memory - Retrieve user memory
async function handleGet(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let memory;

    if (search) {
      // Sanitize search query
      const sanitizedSearch = InputSanitizer.sanitizeSearchQuery(search);
      if (sanitizedSearch.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid search query' },
          { status: 400 }
        );
      }
      memory = await searchMemory(user.id, sanitizedSearch);
    } else {
      // Validate category if provided
      if (category && !InputSanitizer.validateCategory(category)) {
        return NextResponse.json(
          { success: false, error: 'Invalid category' },
          { status: 400 }
        );
      }
      memory = await getUserMemory(
        user.id, 
        category as any || undefined
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: memory 
    });
  } catch (error: any) {
    console.error('GET /api/memory error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/memory - Add new memory
async function handlePost(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { key, value, category } = body;

    if (!key || !value || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: key, value, category' },
        { status: 400 }
      );
    }

    // Validate category
    if (!InputSanitizer.validateCategory(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedKey = InputSanitizer.sanitizeText(key);
    const sanitizedValue = InputSanitizer.sanitizeMemory(value);

    if (sanitizedKey.length === 0 || sanitizedValue.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid key or value' },
        { status: 400 }
      );
    }

    const memory = await addMemory(user.id, sanitizedKey, sanitizedValue, category);

    return NextResponse.json({ 
      success: true, 
      data: memory 
    });
  } catch (error: any) {
    console.error('POST /api/memory error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/memory - Update memory
async function handlePut(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { memoryId, value } = body;

    if (!memoryId || !value) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: memoryId, value' },
        { status: 400 }
      );
    }

    // Validate memory ID format
    if (!InputSanitizer.validateUUID(memoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid memory ID format' },
        { status: 400 }
      );
    }

    // Sanitize value
    const sanitizedValue = InputSanitizer.sanitizeMemory(value);
    if (sanitizedValue.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid value' },
        { status: 400 }
      );
    }

    // Verify ownership before updating
    const existingMemory = await getUserMemory(user.id);
    const memoryExists = existingMemory.some(m => m.id === memoryId);
    
    if (!memoryExists) {
      return NextResponse.json(
        { success: false, error: 'Memory item not found or access denied' },
        { status: 404 }
      );
    }

    const memory = await updateMemory(memoryId, sanitizedValue);

    return NextResponse.json({ 
      success: true, 
      data: memory 
    });
  } catch (error: any) {
    console.error('PUT /api/memory error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/memory - Delete memory
async function handleDelete(request: NextRequest, context: any) {
  try {
    const { user } = context;
    const body = await request.json();
    const { memoryId, clearAll } = body;

    if (clearAll) {
      // Clear all user memory
      await clearAllUserMemory(user.id);
      return NextResponse.json({ 
        success: true, 
        message: 'All memory cleared' 
      });
    }

    if (!memoryId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: memoryId' },
        { status: 400 }
      );
    }

    // Validate memory ID format
    if (!InputSanitizer.validateUUID(memoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid memory ID format' },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const existingMemory = await getUserMemory(user.id);
    const memoryExists = existingMemory.some(m => m.id === memoryId);
    
    if (!memoryExists) {
      return NextResponse.json(
        { success: false, error: 'Memory item not found or access denied' },
        { status: 404 }
      );
    }

    await deleteMemory(memoryId);

    return NextResponse.json({ 
      success: true, 
      message: 'Memory deleted' 
    });
  } catch (error: any) {
    console.error('DELETE /api/memory error:', error);
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
