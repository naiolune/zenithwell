'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send, ArrowLeft, Loader2, Clock, Crown, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from '@/types';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

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
      
      // Check if this is an introduction session
      if (result.session.session_type === 'introduction') {
        setIsIntroductionSession(true);
        // Check if user has provided enough responses to complete introduction
        const userMessages = result.messages.filter((msg: ChatMessage) => msg.sender === 'user');
        if (userMessages.length >= 2) { // At least 2 user responses
          setShowCompleteIntroduction(true);
        }
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
      setLoading(true);
      
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
          content: `Thank you for completing your introduction! I've extracted and stored your goals:

**Your Wellness Goals:**
${result.goals.map((goal: any, index: number) => `${index + 1}. ${goal.goal_text}`).join('\n')}

These goals will guide our future sessions together. You can now create regular wellness sessions whenever you're ready!`,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, completionMessage]);
        setShowCompleteIntroduction(false);
        setIsIntroductionSession(false);
        
        // Update session title
        setSessionTitle('Introduction Complete - Goals Set');
      } else {
        throw new Error(result.error || 'Failed to complete introduction');
      }
    } catch (error) {
      console.error('Error completing introduction:', error);
      alert('Failed to complete introduction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageToResend?: ChatMessage) => {
    const messageContent = messageToResend ? messageToResend.content : inputMessage;
    if (!messageContent.trim() || loading || sessionEnded || initializing) return;

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const canResumeSession = () => {
    return userSubscription === 'pro';
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/sessions')}
            className="hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">AI</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{sessionTitle}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">AI Wellness Coach</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {userSubscription === 'free' && timeRemaining !== null && (
            <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Online</span>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto px-4 py-6">
          <div className="h-full overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {initializing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Initializing Session</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md">
              Setting up your wellness session...
            </p>
          </div>
        ) : sessionEnded && userSubscription === 'free' ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Session Access Restricted</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
              Free users cannot resume existing sessions. You can only start new sessions. Upgrade to Pro to resume any session at any time.
            </p>
            <div className="flex space-x-4">
              <Button
                onClick={() => router.push('/dashboard/sessions')}
                variant="outline"
                className="px-6"
              >
                Back to Sessions
              </Button>
              <Button
                onClick={() => router.push('/dashboard/settings')}
                className="px-6 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group mb-6`}
            >
              <div className={`flex items-start space-x-3 max-w-3xl ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shadow-lg ${
                  message.sender === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                }`}>
                  {message.sender === 'user' ? 'U' : 'AI'}
                </div>
                
                {/* Message */}
                <div className={`flex flex-col space-y-2 ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-6 py-4 rounded-3xl shadow-lg max-w-2xl ${
                    message.sender === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-lg' 
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-lg'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                  <div className={`flex items-center space-x-2 ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
                      {message.timestamp instanceof Date 
                        ? message.timestamp.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })
                        : new Date(message.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })
                      }
                    </span>
                    {message.sender === 'ai' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">AI Coach</span>
                      </div>
                    )}
                    {message.sender === 'user' && message.needsResend && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendMessage(message)}
                        disabled={loading || message.isResending}
                        className="text-xs px-2 py-1 h-6 bg-red-50 hover:bg-red-100 border-red-200 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-800 dark:text-red-400"
                      >
                        {message.isResending ? (
                          <>
                            <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                            Resending...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Resend
                            {message.resendCount && message.resendCount > 0 && (
                              <span className="ml-1 text-xs">({message.resendCount})</span>
                            )}
                          </>
                        )}
                      </Button>
                    )}
                    {message.sender === 'user' && canDeleteMessage(message, index) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteMessage(message)}
                        className="text-xs px-2 py-1 h-6 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-800/20 dark:hover:bg-gray-800/30 dark:border-gray-700 dark:text-gray-400"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3 max-w-2xl">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-medium text-white">
                AI
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Complete Introduction Button */}
      {showCompleteIntroduction && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-t border-emerald-200 dark:border-emerald-700 p-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
              Ready to complete your introduction? I'll extract your goals and prepare for future sessions.
            </p>
            <Button
              onClick={completeIntroduction}
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-full font-medium transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing Introduction...
                </>
              ) : (
                'Complete Introduction & Set Goals'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Share your thoughts, feelings, or wellness goals..."
                className="w-full min-h-[48px] max-h-32 px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none dark:bg-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200"
                disabled={loading || sessionEnded || initializing || !!pendingMessage}
                rows={1}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Button
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || loading || sessionEnded || initializing || !!pendingMessage}
                  size="sm"
                  className="w-8 h-8 p-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
