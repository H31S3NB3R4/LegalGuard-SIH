'use client';

// Chatbot drawer/panel - tododesign Phase 6 + design.md tokens.
// Right-hand drawer using surface/border tokens; answers are visually
// distinguished by intent (backend /api/chat returns intent
// 'personal_data' | 'general_compliance'): "Your data" answers get a
// Database icon + accent tag, "Regulation" answers get a ShieldCheck icon +
// neutral tag. Mounted in AppShell so it is reachable from any screen.

import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  Database,
  ShieldCheck,
  Brain,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const GREETING =
  "Hello! I'm your AI compliance assistant. I can help you with:\n\n" +
  '- Personal data queries: your products, compliance scores, and statistics\n' +
  '- General compliance: regulations, rules, and requirements\n\n' +
  'How can I help you today?';

function intentStyle(intent) {
  switch (intent) {
    case 'personal_data':
      return {
        icon: Database,
        label: 'Your data',
        tag: 'bg-surface text-accent border-accent',
      };
    case 'general_compliance':
      return {
        icon: ShieldCheck,
        label: 'Regulation',
        tag: 'bg-surface text-secondary border-default',
      };
    case 'error':
      return {
        icon: AlertCircle,
        label: 'Error',
        tag: 'bg-surface text-critical border-critical',
      };
    default:
      return {
        icon: Brain,
        label: 'Assistant',
        tag: 'bg-surface text-secondary border-default',
      };
  }
}

function renderContent(text) {
  if (!text) return null;
  const parts = String(text).split('\n');
  return parts.map((line, i) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-');
    const content = (isBullet ? trimmed.replace(/^[*-]\s*/, '') : line).split(
      /\*\*(.*?)\*\*/g
    );
    const nodes = content.map((seg, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-semibold text-primary">
          {seg}
        </strong>
      ) : (
        <span key={j}>{seg}</span>
      )
    );
    return isBullet ? (
      <div key={i} className="flex gap-2">
        <span className="text-accent">*</span>
        <span className="flex-1">{nodes}</span>
      </div>
    ) : (
      <span key={i} className="block">
        {nodes}
      </span>
    );
  });
}

export default function ChatbotPanel({ embedded = false, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: GREETING,
      intent: 'greeting',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const storedUserId =
      typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
    const storedAuth =
      typeof window !== 'undefined' ? localStorage.getItem('isAuthenticated') : null;
    if (!storedUserId || storedAuth !== 'true') {
      setMessages(function (prev) {
        return prev.concat([
          {
            role: 'assistant',
            content: 'Authentication required. Please log in to continue.',
            intent: 'error',
            timestamp: new Date().toISOString(),
          },
        ]);
      });
      return;
    }

    const userMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(function (prev) {
      return prev.concat([userMessage]);
    });
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: inputMessage.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setMessages(function (prev) {
        return prev.concat([
          {
            role: 'assistant',
            content: data.message,
            intent: data.intent,
            user_context: data.user_context,
            timestamp: data.timestamp,
          },
        ]);
      });
    } catch (error) {
      console.error('Chat API error:', error);
      setMessages(function (prev) {
        return prev.concat([
          {
            role: 'assistant',
            content: 'Error: ' + error.message,
            intent: 'error',
            timestamp: new Date().toISOString(),
          },
        ]);
      });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyPress = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = function () {
    setMessages([
      {
        role: 'assistant',
        content: GREETING,
        intent: 'greeting',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div
      className={
        'flex flex-col bg-surface ' +
        (embedded
          ? 'border border-default rounded-card shadow-card h-[calc(100vh-12rem)] max-h-[820px]'
          : 'h-full')
      }
    >
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-default shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-pill bg-nav-active flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary truncate">
              Compliance assistant
            </p>
            <p className="text-[11px] text-secondary truncate">
              Your data &amp; regulation answers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearChat}
            className="w-8 h-8 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted transition-colors"
            aria-label="Clear chat"
            title="Clear chat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted transition-colors"
              aria-label="Close chat"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 thin-scrollbar">
        {messages.map(function (message, index) {
          const isUser = message.role === 'user';
          const style = intentStyle(message.intent);
          const IntentIcon = style.icon;
          const time = new Date(message.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={index}
              className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}
            >
              <div className="max-w-[85%]">
                {!isUser ? (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className={
                        'inline-flex items-center gap-1 h-6 px-2.5 rounded-pill border text-[11px] font-semibold ' +
                        style.tag
                      }
                    >
                      <IntentIcon className="w-3 h-3" />
                      {style.label}
                    </span>
                    <span className="text-[11px] text-muted">{time}</span>
                  </div>
                ) : null}
                <div
                  className={
                    'px-4 py-3 text-sm leading-relaxed rounded-card ' +
                    (isUser
                      ? 'bg-accent text-white'
                      : 'bg-page border border-default text-primary')
                  }
                >
                  <div className="space-y-1 whitespace-pre-line">
                    {renderContent(message.content)}
                  </div>
                </div>
                {isUser ? (
                  <p className="mt-1 text-[11px] text-muted text-right">{time}</p>
                ) : null}
              </div>
            </div>
          );
        })}
        {loading ? (
          <div className="flex items-center gap-2 text-secondary text-sm px-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking...
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-default shrink-0 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={function () {
              setInputMessage('What are my average compliance scores?');
            }}
            className="h-7 px-3 rounded-pill bg-page border border-default text-[11px] font-medium text-secondary hover:text-primary hover:border-muted transition-colors"
          >
            My stats
          </button>
          <button
            type="button"
            onClick={function () {
              setInputMessage('What is the Legal Metrology Act?');
            }}
            className="h-7 px-3 rounded-pill bg-page border border-default text-[11px] font-medium text-secondary hover:text-primary hover:border-muted transition-colors"
          >
            Legal Metrology
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={function (e) {
              setInputMessage(e.target.value);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your products or compliance regulations..."
            className="flex-1 px-4 py-2.5 bg-surface border border-default rounded-tile text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            rows="1"
            disabled={loading}
            style={{ minHeight: '42px', maxHeight: '110px' }}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
            className="w-11 h-11 rounded-tile bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Press Enter to send - Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}
