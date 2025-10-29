import DOMPurify from 'isomorphic-dompurify';

/**
 * Security utility for input sanitization and validation
 */
export class InputSanitizer {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHTML(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  /**
   * Sanitize text content (removes HTML tags)
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining angle brackets
      .trim();
  }

  /**
   * Validate and sanitize message content
   */
  static sanitizeMessage(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove HTML tags and dangerous characters
    let sanitized = input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim();

    // Limit length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }

  /**
   * Validate and sanitize goal text
   */
  static sanitizeGoal(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = this.sanitizeText(input);
    
    // Limit length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500);
    }

    return sanitized;
  }

  /**
   * Validate and sanitize memory content
   */
  static sanitizeMemory(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = this.sanitizeText(input);
    
    // Limit length
    if (sanitized.length > 2000) {
      sanitized = sanitized.substring(0, 2000);
    }

    return sanitized;
  }

  /**
   * Validate UUID format
   */
  static validateUUID(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(input);
  }

  /**
   * Validate session ID
   */
  static validateSessionId(input: string): boolean {
    return this.validateUUID(input);
  }

  /**
   * Validate user ID
   */
  static validateUserId(input: string): boolean {
    return this.validateUUID(input);
  }

  /**
   * Validate email format
   */
  static validateEmail(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input) && input.length <= 254;
  }

  /**
   * Validate category for memory/goals
   */
  static validateCategory(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    const validCategories = ['goals', 'preferences', 'background', 'progress', 'custom'];
    return validCategories.includes(input.toLowerCase());
  }

  /**
   * Validate status for goals
   */
  static validateGoalStatus(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    const validStatuses = ['active', 'achieved', 'paused'];
    return validStatuses.includes(input.toLowerCase());
  }

  /**
   * Sanitize search query
   */
  static sanitizeSearchQuery(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = this.sanitizeText(input);
    
    // Remove SQL injection patterns
    sanitized = sanitized.replace(/['";\\]/g, '');
    
    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
  }
}