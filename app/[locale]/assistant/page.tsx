"use client"

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assistantApi } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function AssistantContent() {
  const t = useTranslations('assistant');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('askAnything'),
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setLoading(true);

    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to use the AI assistant');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Please log in to use the AI assistant.",
          timestamp: new Date()
        }]);
        setLoading(false);
        return;
      }

      const response = await assistantApi.chat(userMessage);
      
      // Add AI response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.response,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      console.error('AI Assistant Error:', error);
      toast.error(error.message || 'Failed to get response');
      
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try logging out and back in, then try again.",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    t('example1'),
    t('example2'),
    t('example3'),
    t('example4'),
    "Show me my recent transactions",
    "Give me financial advice"
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('askAnything')}</p>
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <Card className="p-4 mb-4">
          <p className="text-sm font-medium mb-3">{t('examples')}:</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuestion(q)}
                className="text-xs"
              >
                {q}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-primary text-white'
                    : 'bg-accent'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-accent rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-primary"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <AssistantContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
