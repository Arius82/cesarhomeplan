import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!session) return <SignIn />;
  return (
    <>
      {children}
      <div className="no-print mx-auto max-w-6xl px-4 pb-6 text-right text-xs text-muted-foreground">
        {session.user.email} ·{" "}
        <button className="underline cursor-pointer" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    </>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return toast.error(mode === "in" ? "E-mail ou senha incorretos." : "Não foi possível criar a conta.");
    if (mode === "up" && !data.session) toast.success("Confira seu e-mail para confirmar a conta.");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if ("error" in r && r.error) toast.error("Não foi possível entrar com o Google.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">🏠 Cesar Home Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "in" ? "Entre para ver as tarefas da família." : "Crie sua conta da família."}
        </p>
        <Button type="button" variant="outline" className="mt-5 w-full" onClick={google}>Entrar com Google</Button>
        <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Criar conta"}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground underline cursor-pointer"
          onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Primeira vez? Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
