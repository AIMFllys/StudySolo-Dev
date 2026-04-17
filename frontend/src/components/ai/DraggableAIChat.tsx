'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, X, Minus, Maximize2, GripHorizontal, Send, Loader2 } from 'lucide-react';
import { useMobileAIStore } from '@/stores/use-mobile-ai-store';
import { useAIChatStore } from '@/stores/use-ai-chat-store';

interface Position {
  x: number;
  y: number;
}

export function DraggableAIChat() {
  const { isOpen, isMinimized, close, minimize, restore, position, setPosition } = useMobileAIStore();
  const { history: messages, input, setInput, loading: isLoading, pushMessage } = useAIChatStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 320, height: 400 });
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: Math.min(320, window.innerWidth - 32),
        height: Math.min(400, window.innerHeight - 200),
      });
      // Ensure chat stays within viewport
      setPosition({
        x: Math.min(position.x, window.innerWidth - 320),
        y: Math.min(position.y, window.innerHeight - 400),
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!chatRef.current) return;
    
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragOffset({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  }, [position]);

  const handleDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const newX = Math.max(0, Math.min(clientX - dragOffset.x, window.innerWidth - windowSize.width));
    const newY = Math.max(0, Math.min(clientY - dragOffset.y, window.innerHeight - windowSize.height));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, windowSize, setPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global drag listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      pushMessage('user', input.trim());
      setInput('');
      // Simulate AI response (in real implementation, this would call an API)
      setTimeout(() => {
        pushMessage('assistant', '收到您的消息！这是一个示例回复。');
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  // Minimized state - show as floating bubble
  if (isMinimized) {
    return (
      <button
        onClick={restore}
        className="fixed z-[200] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          left: position.x,
          top: position.y,
        }}
        aria-label="打开AI助手"
      >
        <Bot className="h-6 w-6" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-medium">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      className={`fixed z-[200] bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden transition-shadow ${
        isDragging ? 'shadow-2xl ring-2 ring-primary/20 cursor-grabbing' : 'cursor-default'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: windowSize.width,
        height: windowSize.height,
      }}
    >
      {/* Header - draggable area */}
      <div
        className="flex items-center justify-between px-3 py-2.5 bg-muted/50 border-b border-border cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">AI助手</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={minimize}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="最小化"
          >
            <Minus className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              你好！我是AI助手
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              可以帮你创建工作流、解答问题
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 bg-background rounded-xl px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            aria-label="发送"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
