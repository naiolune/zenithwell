'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft, Loader2, Users, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserSubscription, canAccessProFeature } from '@/lib/subscription';
import { ChatMessage } from '@/types';
import { ParticipantList } from '@/components/ParticipantStatus';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { GROUP_SESSION_CONFIG } from '@/lib/group-session-config';

interface SessionData {
  session_id: string;
  title: string;
  group_category: string;
  session_status: string;
  user_id: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

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
    };
  }, [sessionId]);

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

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: messageToSend,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
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

    } catch (error) {
      console.error('Error sending message:', error);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const readyParticipants = participants.filter(p => p.is_ready).length;
  const allParticipantsReady = participants.length > 0 && readyParticipants === participants.length;

  return (
    <div className="h-screen flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/group')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold dark:text-white">{sessionData?.title}</h1>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="capitalize">
                  {sessionData?.group_category}
                </Badge>
                <Badge variant={sessionData?.session_status === 'active' ? 'default' : 'secondary'}>
                  {sessionData?.session_status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isOwner && (
              <ShareLinkDialog
                sessionId={sessionId}
                currentParticipants={participants.length}
                maxParticipants={GROUP_SESSION_CONFIG.MAX_PARTICIPANTS_PER_SESSION}
                isOwner={isOwner}
                onRefresh={fetchParticipants}
              />
            )}
          </div>
        </div>

        {/* Waiting Room Banner */}
        {sessionData?.session_status === 'waiting' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Waiting Room
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {allParticipantsReady 
                    ? 'All participants are ready. Session can start!'
                    : `${readyParticipants}/${participants.length} participants ready`
                  }
                </p>
              </div>
              {isOwner && allParticipantsReady && (
                <Button onClick={startSession} size="sm">
                  Start Session
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Presence Warning */}
        {waitingForParticipants && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">
                All participants must be online to continue the conversation.
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <p>Start a group conversation with your AI wellness coach</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-xs lg:max-w-md ${
                  message.sender === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200'
                }`}>
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </CardContent>
                </Card>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <Card className="bg-gray-100 dark:bg-gray-800">
                <CardContent className="p-3 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm dark:text-gray-300">AI is thinking...</span>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4">
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !canSendMessage() 
                  ? "Waiting for all participants to be online..." 
                  : "Type your message..."
              }
              className="flex-1 min-h-[40px] max-h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none dark:bg-gray-900 dark:text-white"
              disabled={loading || !canSendMessage()}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || loading || !canSendMessage()}
              className="px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Participants Sidebar */}
      <div className="w-80 bg-gray-50 dark:bg-gray-800 border-l dark:border-gray-700 p-4">
        <div className="space-y-4">
          <ParticipantList
            participants={participants.map(p => ({
              user_id: p.user_id,
              user_name: p.full_name,
              user_email: p.email,
              is_ready: p.is_ready,
              is_online: p.is_online,
              is_away: p.is_away,
              last_heartbeat: p.last_heartbeat,
              presence_status: p.presence_status as any
            }))}
            allOnline={allOnline}
            totalParticipants={participants.length}
            onlineParticipants={participants.filter(p => p.is_online).length}
          />

          {/* Ready Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={markAsReady}
                variant={isReady ? "default" : "outline"}
                size="sm"
                className="w-full"
              >
                {isReady ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Ready
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Mark as Ready
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Session Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Session Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="capitalize">{sessionData?.group_category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="capitalize">{sessionData?.session_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Participants:</span>
                <span>{participants.length}/{GROUP_SESSION_CONFIG.MAX_PARTICIPANTS_PER_SESSION}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}