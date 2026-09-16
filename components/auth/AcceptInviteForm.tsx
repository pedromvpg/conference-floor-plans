"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";

function generatePassword(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function fillGenerated() {
    const next = generatePassword();
    setPassword(next);
    setConfirm(next);
    setShowPassword(true);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Invite failed.");
        setBusy(false);
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Invite failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-3">
      <p className="text-sm text-muted-foreground">
        You will join with the role on this invite (editor, viewer, or admin) for the maps listed. Copy a generated
        password somewhere safe before you continue — we only keep a salted hash.
      </p>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          className="mt-1"
          type="email"
          required
          disabled={busy}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="password">New password</Label>
          <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={fillGenerated}>
            Generate random password
          </Button>
        </div>
        <Input
          id="password"
          className="mt-1"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          disabled={busy}
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setShowPassword(false);
          }}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          className="mt-1"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          disabled={busy}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        The server hashes this with scrypt and a random salt. Nobody on the team can read the password back.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" variant="inverse" size="lg" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create password and join"}
      </Button>
    </form>
  );
}
