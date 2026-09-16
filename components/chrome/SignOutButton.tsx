"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="glass"
      size="lg"
      type="button"
      onClick={() => {
        void fetch("/api/auth/demo", { method: "DELETE" }).then(() => {
          router.push("/");
          router.refresh();
        });
      }}
    >
      Sign out
    </Button>
  );
}
