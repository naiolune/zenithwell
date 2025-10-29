'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GROUP_SESSION_CONFIG, PresenceStatus } from '@/lib/group-session-config';

interface ParticipantStatusProps {
  user_id: string;
  user_name: string;
  user_email: string;
  is_ready: boolean;
  is_online: boolean;
  is_away: boolean;
  last_heartbeat: string;
  presence_status: PresenceStatus;
}

export function ParticipantStatus({
  user_id,
  user_name,
  user_email,
  is_ready,
  is_online,
  is_away,
  last_heartbeat,
  presence_status
}: ParticipantStatusProps) {
  const getStatusColor = () => {
    if (is_online) return 'bg-green-500';
    if (is_away) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (is_online) return 'Online';
    if (is_away) return 'Away';
    return 'Offline';
  };

  const getLastSeenText = () => {
    const lastSeen = new Date(last_heartbeat);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = () => {
    if (is_online) return '🟢';
    if (is_away) return '🟡';
    return '🔴';
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center space-x-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <span className="text-sm font-medium">{user_name}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium">{getStatusText()}</p>
                <p className="text-xs text-muted-foreground">
                  Last seen: {getLastSeenText()}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center space-x-2">
          {is_ready && (
            <Badge variant="secondary" className="text-xs">
              Ready
            </Badge>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <span>{getStatusIcon()}</span>
                <span>{getStatusText()}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium">{user_email}</p>
                <p className="text-xs text-muted-foreground">
                  Last activity: {getLastSeenText()}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ParticipantListProps {
  participants: ParticipantStatusProps[];
  allOnline: boolean;
  totalParticipants: number;
  onlineParticipants: number;
}

export function ParticipantList({ 
  participants, 
  allOnline, 
  totalParticipants, 
  onlineParticipants 
}: ParticipantListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Participants</h3>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className={`w-2 h-2 rounded-full ${allOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{onlineParticipants}/{totalParticipants} online</span>
        </div>
      </div>

      <div className="space-y-2">
        {participants.map((participant) => (
          <ParticipantStatus
            key={participant.user_id}
            {...participant}
          />
        ))}
      </div>

      {!allOnline && (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Waiting for all participants to come online...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
