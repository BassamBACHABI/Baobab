import { useEffect, useRef, useState } from "react";
import { Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AdminSupport() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const loadThreads = async () => {
    try { const { data } = await api.get("/admin/support/threads"); setThreads(data); }
    catch { toast.error("Erreur de chargement."); }
  };
  const openThread = async (uid) => {
    setActive(uid);
    try { const { data } = await api.get(`/admin/support/threads/${uid}`); setMessages(data.messages); setClient(data.client); }
    catch { toast.error("Erreur de chargement."); }
  };
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const reply = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setBusy(true);
    try { const { data } = await api.post(`/admin/support/threads/${active}`, { body: text }); setMessages(data); setText(""); loadThreads(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Back-office" title="Support" subtitle="Conversations avec les clients." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border lg:col-span-1"><CardContent className="p-3">
          <div className="space-y-1" data-testid="support-threads">
            {threads.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aucune conversation.</p> : threads.map((t) => (
              <button key={t.user_id} data-testid={`thread-${t.user_id}`} onClick={() => openThread(t.user_id)} className={cn("w-full rounded-xl p-3 text-left transition-colors", active === t.user_id ? "bg-accent/10" : "hover:bg-secondary")}>
                <p className="text-sm font-semibold text-foreground">{t.client_name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.last}</p>
              </button>
            ))}
          </div>
        </CardContent></Card>

        <Card className="rounded-2xl border-border lg:col-span-2"><CardContent className="flex h-[60vh] flex-col p-0">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"><LifeBuoy className="mb-2 h-8 w-8 text-accent/50" /><p className="text-sm">Sélectionnez une conversation.</p></div>
          ) : (
            <>
              <div className="border-b border-border p-4"><p className="text-sm font-semibold">{client ? `${client.first_name} ${client.last_name}` : "Client"}</p><p className="text-xs text-muted-foreground">{client?.email}</p></div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5" data-testid="admin-support-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "STAFF" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === "STAFF" ? "bg-accent text-white" : "bg-secondary text-foreground"}`}>
                      <p>{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.sender === "STAFF" ? "text-white/70" : "text-muted-foreground"}`}>{m.sender === "STAFF" ? (m.sender_name || "Support") : "Client"} · {new Date(m.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form onSubmit={reply} className="flex gap-2 border-t border-border p-4">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Répondre…" data-testid="admin-support-input" className="h-11 rounded-xl" />
                <Button type="submit" disabled={busy} data-testid="admin-support-send" className="h-11 rounded-xl bg-accent text-white hover:bg-[#D45A2C]"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
