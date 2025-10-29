'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Clock, AlertCircle, CheckCircle, Circle, CircleDot, Copy, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
import { ChatMessage } from '@/types';
import { ParticipantList } from '@/components/ParticipantStatus';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { GROUP_SESSION_CONFIG } from '@/lib/group-session-config';
import SessionSidebar from '@/components/chat/SessionSidebar';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import QuickActions from '@/components/chat/QuickActions';
import BreakPrompt from '@/components/chat/BreakPrompt';
import EmergencyResources from '@/components/EmergencyResources';

interface SessionData {
  session_id: string;
  title: string;
  group_category: string;
  session_status: string;
  user_id: string;
  created_at?: string;
}

interface Participant {
  user_id: string;
  email: string;
  full_name: string;
  is_ready: boolean;
  is_online: boolean;
  is_away: boolean;
  last_heartbeat: string;
  presence_status: string;
}

export default function GroupSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allOnline, setAllOnline] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [waitingForParticipants, setWaitingForParticipants] = useState(false);
  const [sessionWaiting, setSessionWaiting] = useState(false);
  const [messageTimeouts, setMessageTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [pendingMessage, setPendingMessage] = useState<ChatMessage | null>(null);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [showEmergencyResources, setShowEmergencyResources] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const messageStats = useMemo(() => {
    const coachCount = messages.filter(msg => msg.sender === 'ai').length;
    return {
      total: messages.length,
      coachCount,
      userCount: messages.length - coachCount,
    };
  }, [messages]);

  useEffect(() => {
    loadUserData();
    fetchSessionData();
    fetchMessages();
    startHeartbeat();
    setupRealtimeSubscription();

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // Cleanup message timeouts
      messageTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [sessionId, messageTimeouts]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUserData = async () => {
    const { isPro } = await getUserSubscription();
    setIsPro(isPro);
    
    if (!canAccessProFeature(isPro, 'group_sessions')) {
      alert('Group sessions are only available with a Pro subscription.');
      router.push('/dashboard/group');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user is the owner of this session
    const { data: session } = await supabase
      .from('therapy_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .single();

    if (session) {
      setIsOwner(session.user_id === user.id);
    }
  };

  const fetchSessionData = async () => {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session data:', error);
      return;
    }

    setSessionData(data);
  };

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .rpc('get_session_participants', { session_uuid: sessionId });

    if (error) {
      console.error('Error fetching participants:', error);
      return;
    }

    setParticipants(data.participants || []);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
  };

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('update_presence', {
          session_uuid: sessionId,
          is_online: true,
          is_away: false
        });
      }
    }, 30000); // Every 30 seconds
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_messages',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages(prev => [...prev, newMessage]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        fetchParticipants();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence state:', state);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      sender: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          message: inputMessage.trim(),
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.waitingForParticipants) {
          setWaitingForParticipants(true);
        } else if (errorData.sessionWaiting) {
          setSessionWaiting(true);
        }
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      
      // Update the user message status
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'sent' }
          : msg
      ));

      // Add AI response
      const aiMessage: ChatMessage = {
        id: data.messageId,
        session_id: sessionId,
        sender: 'ai',
        content: data.message,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  };

  const resendMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    setInputMessage(message.content);
    await sendMessage();
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ messageId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const markAsReady = async () => {
    try {
      const { error } = await supabase.rpc('toggle_ready_status', {
        session_uuid: sessionId
      });

      if (error) throw error;

      setIsReady(!isReady);
      fetchParticipants();
    } catch (error) {
      console.error('Error toggling ready status:', error);
    }
  };

  const startSession = async () => {
    try {
      const { error } = await supabase
        .from('therapy_sessions')
        .update({ session_status: 'active' })
        .eq('session_id', sessionId);

      if (error) throw error;

      setSessionData(prev => prev ? { ...prev, session_status: 'active' } : null);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const removeParticipant = async (userId: string) => {
    if (!isOwner) return;

    try {
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      fetchParticipants();
    } catch (error) {
      console.error('Error removing participant:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSendMessage = () => {
    return sessionData?.session_status === 'active' && 
           !waitingForParticipants && 
           !sessionWaiting;
  };

  const handleCloseEmergencyResources = () => {
    setShowEmergencyResources(false);
  };

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/join/${sessionId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleBreakAccept = () => {
    setShowBreakPrompt(false);
    alert('Inhale for 4 seconds, hold for 4, exhale for 6. Repeat for two minutes.');
  };

  const handleBreakDismiss = () => {
    setShowBreakPrompt(false);
  };

  const renderQuickActions = () => (
    <QuickActions
      onEndSession={() => router.push('/dashboard/group')}
    />
  );

  const readyParticipants = participants.filter(p => p.is_ready).length;
  const allParticipantsReady = participants.length > 0 && readyParticipants === participants.length;

  return (
    <div className="min-h-screen flex bg-slate-900 dark:bg-slate-950">
      {/* Members Sidebar */}
      <div className="w-60 bg-slate-800 dark:bg-slate-900 border-r border-slate-700 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/group')} 
              className="p-1 hover:bg-slate-700 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold text-white truncate">
                {sessionData?.title || 'Group Session'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs capitalize border-slate-600 text-slate-300">
                  {sessionData?.group_category || 'general'}
                </Badge>
                <Badge 
                  variant={sessionData?.session_status === 'active' ? 'default' : 'secondary'} 
                  className="text-xs capitalize"
                >
                  {sessionData?.session_status || 'waiting'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Members — {participants.length}
            </div>
            {participants.map((participant) => (
              <div key={participant.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-medium">
                    {participant.full_name?.charAt(0) || '?'}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 dark:border-slate-900 ${
                    participant.is_online ? 'bg-green-500' : 'bg-slate-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {participant.full_name || 'Unknown User'}
                    </span>
                    {participant.is_ready && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {participant.is_online ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 dark:border-slate-800 space-y-3">
          <Button
            onClick={copyInviteLink}
            variant="outline"
            size="sm"
            className="w-full flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-white"
          >
            {copySuccess ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Invite
              </>
            )}
          </Button>
          {isOwner && (
            <ShareLinkDialog
              sessionId={sessionId}
              currentParticipants={participants.length}
              maxParticipants={GROUP_SESSION_CONFIG.MAX_PARTICIPANTS_PER_SESSION}
              isOwner={isOwner}
              onRefresh={fetchParticipants}
            />
          )}
          {renderQuickActions()}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-slate-800 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="text-sm text-slate-300">
                  {participants.filter(p => p.is_online).length} online
                </span>
              </div>
            </div>
            <div className="text-sm text-slate-400">
              {messageStats.total} messages
            </div>
          </div>
        </div>

        {/* Status Banners */}
        {sessionData?.session_status === 'waiting' && (
          <div className="bg-amber-900/20 border-b border-amber-800/40 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-200">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Waiting room · {readyParticipants}/{participants.length} ready</span>
              </div>
              {isOwner && allParticipantsReady && (
                <Button size="sm" onClick={startSession} className="bg-amber-600 hover:bg-amber-700">
                  Start session
                </Button>
              )}
            </div>
          </div>
        )}

        {waitingForParticipants && (
          <div className="bg-red-900/20 border-b border-red-800/40 px-6 py-3">
            <div className="flex items-center gap-2 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">All participants must be online to continue</span>
            </div>
          </div>
        )}

        {showBreakPrompt && (
          <div className="px-6 pt-4">
            <BreakPrompt visible={showBreakPrompt} onAccept={handleBreakAccept} onDismiss={handleBreakDismiss} />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-900 dark:bg-slate-950">
          <div className="px-6 py-4 space-y-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
                onResend={() => resendMessage(message.id)}
                onDelete={() => deleteMessage(message.id)}
                canDelete={message.sender === 'user' && !loading}
                canResend={message.sender === 'user' && message.status === 'failed'}
              />
            ))}
            {loading && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm">
                  👤
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Your coach is typing...</div>
                  <div className="text-xs text-slate-400">Please wait</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="bg-slate-800 dark:bg-slate-900 border-t border-slate-700 dark:border-slate-800 p-4">
          <ChatInput
            value={inputMessage}
            onChange={setInputMessage}
            onSend={sendMessage}
            onKeyDown={handleInputKeyDown}
            disabled={!canSendMessage() || loading}
            placeholder={
              sessionData?.session_status === 'waiting'
                ? 'Session not started yet...'
                : waitingForParticipants
                ? 'Waiting for all participants...'
                : 'Type your message...'
            }
          />
        </div>
      </div>
    </div>
  );
}