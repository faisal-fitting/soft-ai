"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import { Spinner } from "@/components/ui/spinner";

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
import { useReportStore } from "@/store/report-store";

function getTextFromParts(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function isReportRequest(msg: UIMessage): boolean {
  return msg.role === "user" && getTextFromParts(msg).startsWith("[GENERATE_REPORT_REQUEST]");
}

interface Props {
  businessName: string | null;
  hasReport: boolean;
}

export function ChatSidebar({ businessName, hasReport }: Props) {
  const store = useReportStore();
  const threadId = store.threadId;
  const [loadingHistory, setLoadingHistory] = useState(true);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId, resourceId: "user" },
      }),
    [threadId]
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: chatTransport,
    onError: (err: unknown) => console.error("[chat:error]", err),
  });

  // Fetch and set chat history on mount
  useEffect(() => {
    if (!threadId) {
      setLoadingHistory(false);
      return;
    }

    fetch(`/api/chat?threadId=${threadId}`)
      .then((res) => res.json())
      .then((msgs) => {
        if (msgs.length > 0) {
          setMessages(msgs);
        }
      })
      .catch((err) => console.error("[ChatSidebar] failed to load history:", err))
      .finally(() => setLoadingHistory(false));
  }, [threadId, setMessages]);

  const isGenerating = status === "submitted" || status === "streaming";
  const disabled = !hasReport || loadingHistory;
  const [input, setInput] = useState("");
  const displayMessages = messages.filter((m) => !isReportRequest(m));

  const handleSend = async (text: string) => {
    await sendMessage({ text });
  };

  return (
    <Sidebar
      side="right"
      dir="rtl"
      collapsible="none"
      style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      className="bg-transparent border-s-0"
    >
      <SidebarHeader className="px-4 py-3">
        <p className="text-sm font-semibold">المحادثة</p>
      </SidebarHeader>

      <div className="relative flex flex-1 flex-col min-h-0">
        {disabled && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[2px]">
            <MessageSquare className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center px-6 leading-relaxed">
              ستتمكن من المحادثة
              <br />
              بعد إنشاء التقرير
            </p>
          </div>
        )}

        <SidebarContent className="p-0">
          <Conversation className="flex-1">
            <ConversationContent className="px-3 py-3 gap-4">
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
                      <Message
                        from={msg.role}
                        dir="rtl"
                        className="min-w-0 overflow-hidden"
                      >
                        <MessageContent className="min-w-0 overflow-hidden wrap-anywhere">
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

                {(status === "submitted" || status === "streaming") && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Spinner className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>

              {!isGenerating && hasReport && (
                <div className="flex flex-wrap gap-2">
                  <Suggestion suggestion="ما هي أهم التوصيات؟" onClick={handleSend} />
                  <Suggestion suggestion="تحليل المنافسين بالتفصيل" onClick={handleSend} />
                  <Suggestion suggestion="كيف أحسن هامش الربح؟" onClick={handleSend} />
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <PromptInput
            onSubmit={({ text }) => {
              if (!text.trim() || isGenerating || disabled) return;
              handleSend(text);
              setInput("");
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder="اسأل عن التقرير أو البيانات…"
                disabled={isGenerating || disabled}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <span />
              <PromptInputSubmit
                status={status as "ready" | "submitted" | "streaming" | "error"}
                onStop={stop}
                disabled={(!input.trim() && !isGenerating) || disabled}
              />
            </PromptInputFooter>
          </PromptInput>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
