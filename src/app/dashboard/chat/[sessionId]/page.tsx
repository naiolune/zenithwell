'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage, SessionInsight } from '@/types';
import SessionSidebar from '@/components/chat/SessionSidebar';
import ContextPanel from '@/components/chat/ContextPanel';
import SessionLockBanner from '@/components/chat/SessionLockBanner';
import BreakPrompt from '@/components/chat/BreakPrompt';
import ChatInput from '@/components/chat/ChatInput';
import QuickActions from '@/components/chat/QuickActions';
import MessageBubble from '@/components/chat/MessageBubble';
import EmergencyResources from '@/components/EmergencyResources';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('Wellness Session');
  const [userSubscription, setUserSubscription] = useState<'free' | 'pro'>('free');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isIntroductionSession, setIsIntroductionSession] = useState(false);
  const [showCompleteIntroduction, setShowCompleteIntroduction] = useState(false);
  const [messageTimeouts, setMessageTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [pendingMessage, setPendingMessage] = useState<ChatMessage | null>(null);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [showIntroductionLockedModal, setShowIntroductionLockedModal] = useState(false);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [showEmergencyResources, setShowEmergencyResources] = useState(false);
  const [completingIntroduction, setCompletingIntroduction] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showInsightPanel, setShowInsightPanel] = useState(false);
  const [insights, setInsights] = useState<SessionInsight[]>([]);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const isIntroductionLock = lockReason === 'introduction_complete';

  const messageStats = useMemo(() => {
    const coachCount = messages.filter(msg => msg.sender === 'ai').length;
    return {
      total: messages.length,
      coachCount,
      userCount: messages.length - coachCount,
    };
  }, [messages]);

  useEffect(() => {
    initializeSession();
  }, [sessionId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      messageTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [messageTimeouts]);

  useEffect(() => {
    // Check if free user is trying to resume a session
    // A session is considered "resumed" if it's older than 5 minutes
    if (userSubscription === 'free' && sessionStartTime) {
      const sessionAge = Date.now() - sessionStartTime.getTime();
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if (sessionAge > fiveMinutesInMs) {
        setSessionEnded(true);
      }
    }
  }, [userSubscription, sessionStartTime]);

  // Client-side timer for display only (server-side validation is authoritative)
  useEffect(() => {
    if (sessionStartTime && userSubscription === 'free' && !sessionEnded) {
      const timer = setInterval(() => {
        const elapsed = Date.now() - sessionStartTime.getTime();
        const remaining = Math.max(0, 15 * 60 * 1000 - elapsed); // 15 minutes in milliseconds
        setTimeRemaining(remaining);
        
        // Note: Server-side validation will handle actual session termination
        // This is just for UI display purposes
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [sessionStartTime, userSubscription, sessionEnded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const refreshInsights = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const response = await fetch(`/api/sessions/insights/list?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.insights) {
        setInsights(data.insights);
      }
    } catch (error) {
      console.error('Error refreshing insights:', error);
    }
  };

  const generateInsight = async (silent = false) => {
    try {
      setGeneratingInsight(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!silent) {
          alert('Not authenticated');
        }
        return;
      }

      const response = await fetch('/api/sessions/insights/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (!silent) {
          alert(errorData.error || 'Failed to generate insight');
        }
        return;
      }

      const result = await response.json();
      if (result.success && result.insight) {
        await refreshInsights();
      }
    } catch (error) {
      console.error('Error generating insight:', error);
      if (!silent) {
        alert('Failed to generate insight. Please try again.');
      }
    } finally {
      setGeneratingInsight(false);
    }
  };

  const initializeSession = async () => {
    try {
      setInitializing(true);
      
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call server-side initialization API
      const response = await fetch('/api/sessions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize session');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Session initialization failed');
      }

      // Set session data from server response
      setSessionTitle(result.session.title);
      setSessionStartTime(new Date(result.session.created_at));
      setUserSubscription(result.userSubscription);
      setMessages(result.messages);
      const initialInsights: SessionInsight[] = result.insights || [];
      setInsights(initialInsights);
      setIsSessionLocked(result.session.is_locked || false);
      const sessionLockReason = result.session.lock_reason;
      setLockReason(sessionLockReason);
      setShowEmergencyResources(false);
      setShowBreakPrompt(false);
      
      // Check if this is an introduction session
      if (result.session.session_type === 'introduction') {
        setIsIntroductionSession(true);
        // Check if user has provided enough responses to complete introduction
        const userMessages = result.messages.filter((msg: ChatMessage) => msg.sender === 'user');
        if (userMessages.length >= 2) { // At least 2 user responses
          setShowCompleteIntroduction(true);
        }
      }

      if ((result.session.session_type === 'introduction' || sessionLockReason === 'introduction_complete') && result.session.is_locked) {
        setShowIntroductionLockedModal(true);
      }

      if (initialInsights.length === 0 && result.messages.length > 0) {
        await generateInsight(true);
      }

    } catch (error) {
      console.error('Error initializing session:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error initializing the session. Please try refreshing the page.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    } finally {
      setInitializing(false);
    }
  };

  const completeIntroduction = async () => {
    try {
      setCompletingIntroduction(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/sessions/complete-introduction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete introduction');
      }

      const result = await response.json();

      if (result.success) {
        // Add completion message to the chat
        const completionMessage: ChatMessage = {
          id: 'intro-complete',
          content: `Perfect! I've saved your goals. This introduction session is now complete.

Ready to start your first regular wellness session?`,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, completionMessage]);
        setShowCompleteIntroduction(false);
        setIsIntroductionSession(false);
        setIsSessionLocked(true);
        setLockReason('introduction_complete');
        await refreshInsights();
        await generateInsight(true);
        
        // Update session title
        setSessionTitle('Introduction Complete - Goals Set');
      } else {
        throw new Error(result.error || 'Failed to complete introduction');
      }
    } catch (error) {
      console.error('Error completing introduction:', error);
      alert('Failed to complete introduction. Please try again.');
    } finally {
      setCompletingIntroduction(false);
    }
  };

  const sendMessage = async (messageToResend?: ChatMessage) => {
    const messageContent = messageToResend ? messageToResend.content : inputMessage;
    if (!messageContent.trim() || loading || sessionEnded || initializing || isSessionLocked) return;

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
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call server-side AI API
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
        
        // Handle session expiration
        if (errorData.sessionExpired) {
          setSessionEnded(true);
          throw new Error(errorData.message || 'Session time expired');
        }
        
        // Handle session limit exceeded
        if (errorData.sessionLimitExceeded) {
          setSessionEnded(true);
          throw new Error(errorData.message || 'Session limit exceeded');
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

      await refreshInsights();
      
      // Check if we should show complete introduction button after this message
      if (isIntroductionSession && !showCompleteIntroduction) {
        const userMessages = [...messages, userMessage].filter(msg => msg.sender === 'user');
        if (userMessages.length >= 2) {
          setShowCompleteIntroduction(true);
        }
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCloseEmergencyResources = () => {
    setShowEmergencyResources(false);
  };

  const handleEndSession = () => {
    router.push('/dashboard/sessions');
  };

  const handleBreakAccept = () => {
    setShowBreakPrompt(false);
    alert('Take a deep breath in for 4 seconds, hold for 4, exhale for 6. Repeat 5 times.');
  };

  const handleBreakDismiss = () => {
    setShowBreakPrompt(false);
  };

  const handleStartFirstSession = () => {
    router.push('/dashboard/sessions');
  };

  const renderQuickActions = () =>
    !isSessionLocked && !sessionEnded ? (
      <QuickActions
        onEndSession={handleEndSession}
      />
    ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="bg-white/90 dark:bg-slate-900/80 backdrop-blur border-b border-white/60 dark:border-slate-800 px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/sessions')}
              className="rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
                <span className="text-lg">👤</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{sessionTitle}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Your Coach</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userSubscription === 'free' && timeRemaining !== null && !sessionEnded && (
              <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Online
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <SessionLockBanner
            isLocked={isSessionLocked}
            lockReason={lockReason}
            isIntroductionLock={isIntroductionLock}
            onStartFirstSession={handleStartFirstSession}
            className="border-none"
          />

          {showBreakPrompt && (
            <BreakPrompt
              visible={showBreakPrompt}
              onAccept={handleBreakAccept}
              onDismiss={handleBreakDismiss}
            />
          )}

          <div className="rounded-[32px] border border-white/60 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-xl">
            <div className="max-h-[65vh] sm:max-h-[70vh] lg:max-h-[75vh] overflow-y-auto space-y-6 px-6 py-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {initializing ? (
                <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow animate-pulse">
                    <span className="text-2xl">🌱</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Initializing session</h3>
                  <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
                    Setting up your wellness space and loading previous conversations…
                  </p>
                </div>
              ) : sessionEnded && userSubscription === 'free' ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow">
                    <span className="text-xl">🔒</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Session access restricted</h3>
                  <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
                    Free sessions can&apos;t be resumed once finished. Start a new session anytime or upgrade to ZenithWell Pro for unlimited access.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => router.push('/dashboard/sessions')}>
                      Back to sessions
                    </Button>
                    <Button
                      onClick={() => router.push('/dashboard/settings')}
                      className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
                    >
                      Upgrade to Pro
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="mt-4 text-center text-sm text-slate-400 dark:text-slate-500">
                      Your coach is ready whenever you are. Share what&apos;s on your mind.
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <div
                      key={message.id || `${message.sender}-${index}`}
                      className={message.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <MessageBubble
                        message={message}
                        onResend={handleResendMessage}
                        onDelete={handleDeleteMessage}
                        canDelete={!loading && canDeleteMessage(message, index)}
                      />
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-3xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300">
                        Your coach is typing…
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>

          {!isSessionLocked && (
            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={() => sendMessage()}
              disabled={loading || sessionEnded || initializing || !!pendingMessage}
              placeholder="Share your thoughts, feelings, or wellness goals…"
              onKeyDown={handleInputKeyDown}
            />
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={showInfoPanel ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setShowInfoPanel(prev => !prev)}
            >
              {showInfoPanel ? 'Hide session details' : 'View session details'}
            </Button>
            <Button
              variant={showInsightPanel ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setShowInsightPanel(prev => !prev)}
            >
              {showInsightPanel ? 'Hide insights & support' : 'Insights & support'}
            </Button>
          </div>

          {showInfoPanel && (
            <SessionSidebar
              sessionTitle={sessionTitle}
              onBack={() => router.push('/dashboard/sessions')}
              userSubscription={userSubscription}
              timeRemaining={timeRemaining}
              sessionEnded={sessionEnded}
              sessionStartTime={sessionStartTime}
              isIntroductionSession={isIntroductionSession}
              showCompleteIntroduction={showCompleteIntroduction}
              onCompleteIntroduction={completeIntroduction}
              completingIntroduction={completingIntroduction}
              quickActions={renderQuickActions()}
              introductionCompleted={isIntroductionLock}
              messageStats={messageStats}
              className="bg-white/80 dark:bg-slate-900/70"
            />
          )}

          {showInsightPanel && (
            <ContextPanel
              messages={messages}
              insights={insights}
              isLocked={isSessionLocked}
              lockReason={lockReason}
              showEmergencyResources={showEmergencyResources}
              onCloseEmergencyResources={handleCloseEmergencyResources}
              onGenerateInsight={() => generateInsight(false)}
              generatingInsight={generatingInsight}
              className="bg-white/80 dark:bg-slate-900/70"
            />
          )}

          {showEmergencyResources && !showInsightPanel && (
            <div className="space-y-3">
              <EmergencyResources
                compact
                urgencyLevel="high"
                className="bg-white/80 dark:bg-slate-900/70"
              />
              <Button variant="outline" size="sm" className="rounded-full" onClick={handleCloseEmergencyResources}>
                Close resources
              </Button>
            </div>
          )}
        </div>
      </main>

      <Dialog open={showIntroductionLockedModal} onOpenChange={setShowIntroductionLockedModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Introduction session locked</DialogTitle>
            <DialogDescription>
              Your introduction is already complete. You can start a fresh wellness session or review your introduction history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowIntroductionLockedModal(false)}>
              View history
            </Button>
            <Button onClick={handleStartFirstSession}>
              Start new session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
