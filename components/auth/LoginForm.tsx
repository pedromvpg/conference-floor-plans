"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const sb = createBrowserSupabase();
    if (!sb) {
      setError("Supabase is not configured.");
      setBusy(false);
      return;
    }
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  async function demoLogin() {
    setBusy(true);
    await fetch("/api/auth/demo", { method: "POST" });
    router.push("/events");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      {demo ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Local demo mode — no Supabase. Production uses invited email magic links.
          </p>
          <Button className="w-full" size="lg" onClick={() => void demoLogin()} disabled={busy}>
            Continue as editor
          </Button>
        </div>
      ) : sent ? (
        <p className="text-sm">Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={(e) => void magicLink(e)} className="space-y-3">
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              className="mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            Send magic link
          </Button>
        </form>
      )}
    </div>
  );
}
