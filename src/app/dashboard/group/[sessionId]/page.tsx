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
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessionData = async () => {
    try {
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
      
      // Check if current user is the owner
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data.user_id === user.id) {
        setIsOwner(true);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('session_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        const formattedMessages: ChatMessage[] = (data || []).map(msg => ({
          id: msg.message_id,
          content: msg.content,
          sender: msg.sender_type as 'user' | 'ai',
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`/api/group/presence?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
        setAllOnline(data.all_online || false);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const startHeartbeat = () => {
    // Send heartbeat immediately
    sendHeartbeat();
    
    // Set up interval
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, GROUP_SESSION_CONFIG.HEARTBEAT_INTERVAL_MS);
  };

  const sendHeartbeat = async () => {
    try {
      await fetch('/api/group/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      
      // Refresh participant data
      fetchParticipants();
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    // Subscribe to participant changes
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        }, 
        () => {
          fetchParticipants();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participant_presence',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsReady = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('session_participants')
        .update({ is_ready: !isReady })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating ready status:', error);
      } else {
        setIsReady(!isReady);
        fetchParticipants();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const startSession = async () => {
    if (!isOwner) return;

    try {
      const { error } = await supabase
        .from('therapy_sessions')
        .update({ session_status: 'active' })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error starting session:', error);
      } else {
        setSessionData(prev => prev ? { ...prev, session_status: 'active' } : null);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Set up timeout to detect if AI doesn't respond to a user message
  const setupMessageTimeout = (messageId: string) => {
    const timeout = setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId && msg.sender === 'user'
          ? { ...msg, needsResend: true }
          : msg
      ));
      setMessageTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(messageId);
        return newMap;
      });
    }, 10000); // 10 second timeout

    setMessageTimeouts(prev => new Map(prev.set(messageId, timeout)));
  };

  // Clear timeout when AI responds
  const clearMessageTimeout = (messageId: string) => {
    const timeout = messageTimeouts.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      setMessageTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(messageId);
        return newMap;
      });
    }
  };

  const handleResendMessage = (message: ChatMessage) => {
    sendMessage(message);
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!message.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to delete messages');
        return;
      }

      const response = await fetch('/api/messages/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messageId: message.id,
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete message');
      }

      // Remove message from local state
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  // Check if a user message can be deleted (no AI response after it)
  const canDeleteMessage = (message: ChatMessage, messageIndex: number) => {
    if (message.sender !== 'user') return false;
    
    // Check if there's an AI message after this user message
    const nextMessage = messages[messageIndex + 1];
    return !nextMessage || nextMessage.sender !== 'ai';
  };

  const sendMessage = async (messageToResend?: ChatMessage) => {
    const messageContent = messageToResend ? messageToResend.content : inputMessage;
    if (!messageContent.trim() || loading) return;

    // Prevent sending new messages if there's already a pending message waiting for AI response
    if (!messageToResend && pendingMessage) {
      alert('Please wait for the AI to respond to your previous message before sending a new one.');
      return;
    }

    const userMessage: ChatMessage = {
      id: messageToResend ? messageToResend.id : Date.now().toString(),
      content: messageContent,
      sender: 'user',
      timestamp: new Date(),
      needsResend: false,
      isResending: !!messageToResend,
      resendCount: messageToResend ? (messageToResend.resendCount || 0) + 1 : 0,
    };

    if (messageToResend) {
      // Update existing message
      setMessages(prev => prev.map(msg => 
        msg.id === messageToResend.id 
          ? { ...msg, isResending: true, needsResend: false, resendCount: userMessage.resendCount }
          : msg
      ));
      // Clear any existing timeout for this message
      clearMessageTimeout(messageToResend.id);
    } else {
      // Add new message
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
    }
    
    // Set pending message to prevent new messages
    setPendingMessage(userMessage);
    setLoading(true);
    
    // Set up timeout for user message
    setupMessageTimeout(userMessage.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          message: messageContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle consecutive user message error
        if (errorData.code === 'CONSECUTIVE_USER_MESSAGE') {
          // Remove the message from local state since it wasn't saved to DB
          if (!messageToResend) {
            setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
          }
          setPendingMessage(null);
          clearMessageTimeout(userMessage.id);
          alert('Please wait for the AI to respond before sending another message.');
          return; // Don't add error message to chat
        }
        
        if (errorData.waitingForParticipants) {
          setWaitingForParticipants(true);
          return;
        }
        
        if (errorData.sessionWaiting) {
          setSessionWaiting(true);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'AI response failed');
      }

      // Add AI response to messages
      const aiMessage: ChatMessage = {
        id: result.messageId || Date.now().toString(),
        content: result.message,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

      // Clear timeout and mark the user message as successfully sent
      clearMessageTimeout(userMessage.id);
      setPendingMessage(null); // Clear pending message
      if (messageToResend) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageToResend.id 
            ? { ...msg, isResending: false, needsResend: false }
            : msg
        ));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Clear timeout since we're handling the error
      clearMessageTimeout(userMessage.id);
      setPendingMessage(null); // Clear pending message on error
      
      // Mark user message as needing resend
      if (messageToResend) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageToResend.id 
            ? { ...msg, isResending: false, needsResend: true }
            : msg
        ));
      } else {
        // For new messages, mark the last user message as needing resend
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 && msg.sender === 'user'
            ? { ...msg, needsResend: true }
            : msg
        ));
      }
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSendMessage = () => {
    return allOnline && 
           sessionData?.session_status === 'active' && 
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/95 dark:bg-slate-900/85 backdrop-blur border-b border-white/60 dark:border-slate-800 px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/group')} className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-500" />
                {sessionData?.title || 'Group Session'}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {sessionData?.group_category || 'general'}
                </Badge>
                <Badge variant={sessionData?.session_status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {sessionData?.session_status || 'waiting'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={copyInviteLink}
              className="flex items-center gap-2"
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
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {participants.filter(p => p.is_online).length}/{participants.length} online
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="mx-auto grid h-full max-w-6xl gap-4 lg:grid-cols-[320px,minmax(0,1fr),320px]">
          <div className="hidden lg:block overflow-y-auto rounded-3xl">
            <SessionSidebar
              sessionTitle={sessionData?.title || 'Group Session'}
              onBack={() => router.push('/dashboard/group')}
              userSubscription={isPro ? 'pro' : 'free'}
              timeRemaining={null}
              sessionEnded={sessionData?.session_status === 'ended'}
              sessionStartTime={sessionData?.created_at ? new Date(sessionData.created_at) : null}
              isIntroductionSession={false}
              showCompleteIntroduction={false}
              completingIntroduction={false}
              messageStats={messageStats}
              quickActions={renderQuickActions()}
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-[32px] border border-white/60 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-xl">
            <div className="lg:hidden border-b border-white/60 dark:border-slate-800/60 p-4">
              <SessionSidebar
                sessionTitle={sessionData?.title || 'Group Session'}
                onBack={() => router.push('/dashboard/group')}
                userSubscription={isPro ? 'pro' : 'free'}
                timeRemaining={null}
                sessionEnded={sessionData?.session_status === 'ended'}
                sessionStartTime={sessionData?.created_at ? new Date(sessionData.created_at) : null}
                isIntroductionSession={false}
                showCompleteIntroduction={false}
                completingIntroduction={false}
                messageStats={messageStats}
              />
            </div>

            {sessionData?.session_status === 'waiting' && (
              <div className="border-b border-amber-200/60 bg-amber-50/70 px-6 py-4 dark:border-amber-800/40 dark:bg-amber-900/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-200">
                    <Clock className="h-4 w-4" />
                    Waiting room · {readyParticipants}/{participants.length} ready
                  </div>
                  {isOwner && allParticipantsReady && (
                    <Button size="sm" onClick={startSession}>
                      Start session
                    </Button>
                  )}
                </div>
              </div>
            )}

            {waitingForParticipants && (
              <div className="border-b border-red-200/60 bg-red-50/80 px-6 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">
                <AlertCircle className="mr-2 inline h-4 w-4" />
                All participants must be online to keep the conversation going.
              </div>
            )}

            {showBreakPrompt && (
              <div className="px-6 pt-4">
                <BreakPrompt visible={showBreakPrompt} onAccept={handleBreakAccept} onDismiss={handleBreakDismiss} />
              </div>
            )}

            {showEmergencyResources && (
              <div className="lg:hidden space-y-3 px-6 pt-4">
                <EmergencyResources compact urgencyLevel="medium" />
                <Button variant="outline" size="sm" onClick={handleCloseEmergencyResources}>
                  Close resources
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 px-6 py-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {messages.length === 0 ? (
                <div className="mt-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  When everyone&apos;s ready, share how the group is feeling to begin.
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={message.id || `${message.sender}-${index}`} className={message.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <MessageBubble
                      message={message}
                      onResend={handleResendMessage}
                      onDelete={handleDeleteMessage}
                      canDelete={message.sender === 'user' && canDeleteMessage(message, index)}
                    />
                  </div>
                ))
              )}

              {loading && (
                <div className="flex justify-start text-sm text-slate-500 dark:text-slate-300">
                  <div className="rounded-3xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/70">
                    Your coach is typing…
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={() => sendMessage()}
              disabled={loading || !canSendMessage() || !!pendingMessage}
              placeholder={
                !canSendMessage()
                  ? 'Waiting for all participants to be online…'
                  : 'Share with the group…'
              }
              onKeyDown={handleInputKeyDown}
              quickActions={<div className="lg:hidden">{renderQuickActions()}</div>}
            />
          </div>

          <div className="hidden xl:block overflow-y-auto rounded-3xl border border-white/60 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="space-y-4">
              <Card className="border-none bg-white/70 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Invite Others</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={copyInviteLink}
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Invite Link
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <ParticipantList
                participants={participants.map(p => ({
                  user_id: p.user_id,
                  user_name: p.full_name,
                  user_email: p.email,
                  is_ready: p.is_ready,
                  is_online: p.is_online,
                  is_away: p.is_away,
                  last_heartbeat: p.last_heartbeat,
                  presence_status: p.presence_status as any,
                }))}
                allOnline={allOnline}
                totalParticipants={participants.length}
                onlineParticipants={participants.filter(p => p.is_online).length}
              />

              <Card className="border-none bg-white/70 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Your readiness</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={markAsReady}
                    variant={isReady ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                  >
                    {isReady ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" /> Ready
                      </>
                    ) : (
                      <>
                        <Clock className="mr-2 h-4 w-4" /> Mark as ready
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none bg-white/70 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Session insights</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Total messages</span>
                    <span className="font-medium">{messageStats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coach responses</span>
                    <span className="font-medium">{messageStats.coachCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Participant messages</span>
                    <span className="font-medium">{messageStats.userCount}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:block hidden">{renderQuickActions()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}