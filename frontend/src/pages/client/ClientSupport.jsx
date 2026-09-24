import { useEffect, useRef, useState } from "react";
import { Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClientSupport() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = async () => {
    try { const { data } = await api.get("/me/support/messages"); setMessages(data); api.post("/me/support/seen").catch(() => {}); }
    catch { toast.error("Erreur de chargement."); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { const { data } = await api.post("/me/support/messages", { body: text }); setMessages(data); setText(""); }
    catch (err) { toast.error(apiError(err.response?.data?.detail) || err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Support" subtitle="Une question ? Écrivez-nous, notre équipe vous répond ici." />
      <Card className="rounded-2xl border-border shadow-card"><CardContent className="flex h-[60vh] flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-5" data-testid="support-messages">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <LifeBuoy className="mb-2 h-8 w-8 text-accent/50" />
              <p className="text-sm">Aucun message. Démarrez la conversation avec notre équipe.</p>
            </div>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "CLIENT" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === "CLIENT" ? "bg-accent text-white" : "bg-secondary text-foreground"}`}>
                <p>{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.sender === "CLIENT" ? "text-white/70" : "text-muted-foreground"}`}>{m.sender === "CLIENT" ? "Vous" : (m.sender_name || "Support")} · {new Date(m.created_at).toLocaleString("fr-FR")}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-4">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message…" data-testid="support-input" className="h-11 rounded-xl" />
          <Button type="submit" disabled={busy} data-testid="support-send" className="h-11 rounded-xl bg-accent text-white hover:bg-[#D45A2C]"><Send className="h-4 w-4" /></Button>
        </form>
      </CardContent></Card>
    </div>
  );
}
