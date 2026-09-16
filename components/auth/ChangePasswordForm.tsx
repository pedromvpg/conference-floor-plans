"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function ChangePasswordForm({ demo, hasPassword }: { demo: boolean; hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    if (demo) {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      setBusy(false);
      if (!res.ok) {
        setError(data.error || "Could not update password.");
        return;
      }
    } else {
      const sb = createBrowserSupabase();
      if (!sb) {
        setBusy(false);
        setError("Supabase is not configured.");
        return;
      }
      const { error: err } = await sb.auth.updateUser({ password: newPassword });
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    toast.success("Password updated");
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 max-w-sm space-y-3">
      {hasPassword ? (
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            className="mt-1"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No password yet — choose one to use on sign-in.</p>
      )}
      <div>
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          className="mt-1"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          className="mt-1"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="inverse" size="lg" disabled={busy}>
        Save password
      </Button>
    </form>
  );
}
