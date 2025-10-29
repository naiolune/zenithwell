// Group Session Configuration Constants
// Centralized configuration for group session features

export const GROUP_SESSION_CONFIG = {
  // Participant limits
  MAX_PARTICIPANTS_PER_SESSION: 8,
  MIN_READY_PARTICIPANTS: 2,
  
  // Invite settings
  INVITE_EXPIRATION_HOURS: 24,
  INVITE_CODE_LENGTH: 8,
  
  // Presence tracking
  HEARTBEAT_INTERVAL_MS: 15000, // 15 seconds
  ONLINE_THRESHOLD_SECONDS: 30, // 30 seconds
  AWAY_THRESHOLD_SECONDS: 60,   // 1 minute
  
  // Session statuses
  SESSION_STATUS: {
    WAITING: 'waiting',
    ACTIVE: 'active',
    PAUSED: 'paused',
    ENDED: 'ended'
  } as const,
  
  // Group categories
  GROUP_CATEGORIES: {
    RELATIONSHIP: 'relationship',
    FAMILY: 'family',
    GENERAL: 'general'
  } as const,
  
  // Presence statuses
  PRESENCE_STATUS: {
    ONLINE: 'online',
    AWAY: 'away',
    OFFLINE: 'offline'
  } as const
} as const;

export type SessionStatus = typeof GROUP_SESSION_CONFIG.SESSION_STATUS[keyof typeof GROUP_SESSION_CONFIG.SESSION_STATUS];
export type GroupCategory = typeof GROUP_SESSION_CONFIG.GROUP_CATEGORIES[keyof typeof GROUP_SESSION_CONFIG.GROUP_CATEGORIES];
export type PresenceStatus = typeof GROUP_SESSION_CONFIG.PRESENCE_STATUS[keyof typeof GROUP_SESSION_CONFIG.PRESENCE_STATUS];

// Helper functions
export function isParticipantOnline(lastHeartbeat: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - lastHeartbeat.getTime();
  return diffMs <= GROUP_SESSION_CONFIG.ONLINE_THRESHOLD_SECONDS * 1000;
}

export function isParticipantAway(lastHeartbeat: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - lastHeartbeat.getTime();
  return diffMs > GROUP_SESSION_CONFIG.ONLINE_THRESHOLD_SECONDS * 1000 && 
         diffMs <= GROUP_SESSION_CONFIG.AWAY_THRESHOLD_SECONDS * 1000;
}

export function getPresenceStatus(lastHeartbeat: Date): PresenceStatus {
  if (isParticipantOnline(lastHeartbeat)) {
    return GROUP_SESSION_CONFIG.PRESENCE_STATUS.ONLINE;
  } else if (isParticipantAway(lastHeartbeat)) {
    return GROUP_SESSION_CONFIG.PRESENCE_STATUS.AWAY;
  } else {
    return GROUP_SESSION_CONFIG.PRESENCE_STATUS.OFFLINE;
  }
}

export function getInviteExpirationDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + GROUP_SESSION_CONFIG.INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);
}
