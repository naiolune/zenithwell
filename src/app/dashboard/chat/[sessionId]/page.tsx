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
  const [sessionTitle, setSessionTitle] = useState('Wellness Session');
  const [userSubscription, setUserSubscription] = useState<'free' | 'pro'>('free');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchSessionData();
    fetchMessages();
    fetchUserSubscription();
    checkIfFirstSession();
  }, [sessionId]);

  useEffect(() => {
    // Check if free user is trying to resume a session
    if (userSubscription === 'free' && messages.length > 0) {
      setSessionEnded(true);
    }
  }, [userSubscription, messages.length]);

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

  const fetchSessionData = async () => {
    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('title, created_at')
        .eq('session_id', sessionId)
        .single();

      if (data) {
        setSessionTitle(data.title);
        setSessionStartTime(new Date(data.created_at));
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserSubscription(data.subscription_tier as 'free' | 'pro');
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  const checkIfFirstSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
        .limit(1);

      setIsFirstSession(!data || data.length === 0);
    } catch (error) {
      console.error('Error checking first session:', error);
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
        
        // Add AI introduction for first session if no messages exist
        if (formattedMessages.length === 0 && isFirstSession) {
          const aiIntroduction: ChatMessage = {
            id: 'ai-intro',
            content: `Hello! I'm your AI Wellness Coach. I'm here to support you on your wellness journey. Whether you're looking to work on personal growth, manage stress, build better habits, or explore your thoughts and feelings, I'm here to listen and help guide you.

I use evidence-based approaches to help you:
• Develop coping strategies for stress and anxiety
• Build emotional resilience and self-awareness
• Set and achieve personal wellness goals
• Process difficult emotions and experiences
• Develop healthier thought patterns

What would you like to work on today? Feel free to share what's on your mind, and we can explore it together.`,
            sender: 'ai',
            timestamp: new Date(),
          };
          formattedMessages.push(aiIntroduction);
        } else if (formattedMessages.length === 0 && !isFirstSession) {
          const aiGreeting: ChatMessage = {
            id: 'ai-greeting',
            content: `Welcome back! I'm glad to see you again. How are you feeling today? Is there anything specific you'd like to work on or discuss?`,
            sender: 'ai',
            timestamp: new Date(),
          };
          formattedMessages.push(aiGreeting);
        }
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading || sessionEnded) return;

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
          message: messageToSend,
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
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/sessions')}
            className="hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{sessionTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">AI Wellness Coach</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-slate-500 dark:text-slate-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {sessionEnded && userSubscription === 'free' ? (
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
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Welcome to your Wellness Session</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md">
              Start a conversation with your AI wellness coach. Share your thoughts, feelings, or any wellness goals you'd like to work on.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group`}
            >
              <div className={`flex items-start space-x-3 max-w-2xl ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  message.sender === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                }`}>
                  {message.sender === 'user' ? 'U' : 'AI'}
                </div>
                
                {/* Message */}
                <div className={`flex flex-col space-y-1 ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                    message.sender === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md' 
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-1">
                    {message.timestamp.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </span>
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
                disabled={loading || sessionEnded}
                rows={1}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || loading || sessionEnded}
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
