import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader } from "@/shared/components/ui";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface AskResponse {
  conversationId: string;
  question: string;
  answer: string;
}

const SUGGESTIONS_EN = [
  "how many deliveries are pending?",
  "list in transit deliveries",
  "deliveries to Mumbai",
];

export default function AiChatPage() {
  const { orgId } = useOrg();
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: (q: string) =>
      api<AskResponse>(`/organizations/${orgId}/ai-chat/ask`, {
        method: "POST",
        body: { question: q, conversationId: conversationId ?? undefined },
      }),
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-a`, role: "assistant", content: data.answer },
      ]);
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ask failed"),
  });

  const send = (q: string) => {
    if (!q.trim()) return;
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: "user", content: q }]);
    setQuestion("");
    ask.mutate(q);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(question);
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title={t("chat.title")} />
        <EmptyState message={t("common.selectOrg")} />
      </>
    );
  }

  const suggestions = SUGGESTIONS_EN; // rule-based backend understands English phrasings

  return (
    <>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
      <ErrorBanner message={error} />

      <Card className="flex h-[65vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-2">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white">
                AI
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{t("chat.empty")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user" ? "bubble-user" : "bubble-assistant"
                }`}
              >
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {m.role === "user" ? t("chat.you") : t("chat.assistant")}
                </div>
                {m.content}
              </div>
            </div>
          ))}

          {ask.isPending && (
            <div className="flex justify-start">
              <div className="bubble-assistant max-w-[75%] rounded-2xl px-4 py-2 text-sm text-muted-foreground">
                {t("chat.asking")}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("chat.placeholder")}
            dir={language === "hi" ? "rtl" : "ltr"}
          />
          <Button type="submit" disabled={ask.isPending || !question.trim()}>
            {t("chat.ask")}
          </Button>
        </form>
      </Card>
    </>
  );
}
