"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import type { UIMessage } from "ai";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestion } from "@/components/ai-elements/suggestion";

function getTextFromParts(msg: UIMessage): string {
  return msg.parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p: { type: "text"; text: string }) => p.text)
    .join("");
}

function isReportRequest(msg: UIMessage): boolean {
  return msg.role === "user" && getTextFromParts(msg).startsWith("[GENERATE_REPORT_REQUEST]");
}

interface Props {
  messages: UIMessage[];
  status: string;
  businessName: string | null;
  hasReport: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatSidebar({ messages, status, businessName, hasReport, onSend, onStop }: Props) {
  const isGenerating = status === "submitted" || status === "streaming";
  const [input, setInput] = useState("");
  const displayMessages = messages.filter((m) => !isReportRequest(m));

  if (!hasReport && !isGenerating) return null;

  return (
    <Sidebar side="right" dir="rtl" collapsible="none" style={{ "--sidebar-width": "20rem" } as React.CSSProperties} className="bg-transparent border-s-0">
      <SidebarHeader className="px-4 py-3 border-b">
        <p className="text-sm font-semibold">المحادثة</p>
      </SidebarHeader>

      <SidebarContent className="p-0">
        <Conversation className="flex-1">
          <ConversationContent className="px-3 py-3 gap-4">
            <AnimatePresence>
              {isGenerating && displayMessages.at(-1)?.role === "user" && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3 animate-spin" />
                  <span>جارٍ المعالجة…</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {displayMessages.map((msg) => {
                const text = getTextFromParts(msg);
                if (!text) return null;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Message from={msg.role} dir="rtl" className="min-w-0 overflow-hidden">
                      <MessageContent className="min-w-0 overflow-hidden [overflow-wrap:anywhere]">
                        {msg.role === "assistant" ? (
                          <MessageResponse>{text}</MessageResponse>
                        ) : (
                          <p className="text-sm">{text}</p>
                        )}
                      </MessageContent>
                    </Message>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {!isGenerating && hasReport && (
              <div className="flex flex-wrap gap-2">
                <Suggestion suggestion="ما هي أهم التوصيات؟" onClick={onSend} />
                <Suggestion suggestion="تحليل المنافسين بالتفصيل" onClick={onSend} />
                <Suggestion suggestion="كيف أحسن هامش الربح؟" onClick={onSend} />
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim() || isGenerating) return;
            onSend(text);
            setInput("");
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="اسأل عن التقرير أو البيانات…"
              disabled={isGenerating}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span />
            <PromptInputSubmit
              status={status as "ready" | "submitted" | "streaming" | "error"}
              onStop={onStop}
              disabled={!input.trim() && !isGenerating}
            />
          </PromptInputFooter>
        </PromptInput>
      </SidebarFooter>
    </Sidebar>
  );
}
