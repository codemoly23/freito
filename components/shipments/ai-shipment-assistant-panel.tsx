"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Bot, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Read-only, first version: nothing here is persisted -- the message list
// only lives in this component's state and is gone on page refresh.
export function AiShipmentAssistantPanel({ shipmentId }: { shipmentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, messages: nextMessages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The assistant could not respond.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
      }
    } catch (err) {
      setMessages(nextMessages);
      setError(err instanceof Error ? err.message : "The assistant could not respond.");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-purple-600" />
          AI Shipment Assistant
        </CardTitle>
        <CardDescription>Ask questions about this shipment only. Nothing here is saved.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/50 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">Ask something like &quot;What&apos;s blocking this shipment?&quot;</p>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <Bot className="h-5 w-5 shrink-0 text-purple-600" />}
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-line ${
                    message.role === "user" ? "bg-slate-950 text-white" : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  {message.content || (isStreaming && index === messages.length - 1 ? "..." : "")}
                </div>
                {message.role === "user" && <User className="h-5 w-5 shrink-0 text-slate-400" />}
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this shipment..."
            disabled={isStreaming}
            aria-label="Message"
          />
          <Button type="submit" size="sm" disabled={isStreaming || !input.trim()}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
