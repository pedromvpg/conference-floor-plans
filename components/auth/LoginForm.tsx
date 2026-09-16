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
  const [password, setPassword] = useState("");
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
    const { error: err } = password
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
    setBusy(false);
    if (err) setError(err.message);
    else if (password) {
      router.push("/events");
      router.refresh();
    } else setSent(true);
  }

  async function demoLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in.");
      return;
    }
    router.push("/events");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {demo ? (
        <form onSubmit={(e) => void demoLogin(e)} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sign in with the work email an admin invited and your password. First sign-in for a bootstrap admin
            sets the password. New teammates need a copy-link invite — there is no public sign-up.
          </p>
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
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              className="mt-1"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" variant="inverse" size="lg" type="submit" disabled={busy}>
            Sign in
          </Button>
        </form>
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
          <div>
            <Label htmlFor="password">Password (optional)</Label>
            <Input
              id="password"
              className="mt-1"
              type="password"
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" variant="inverse" size="lg" type="submit" disabled={busy}>
            {password ? "Sign in" : "Send magic link"}
          </Button>
        </form>
      )}
    </div>
  );
}
