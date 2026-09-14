import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { HallSchematic } from "@/components/marketing/HallSchematic";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/store";

export default function LoginPage() {
  const demo = !isSupabaseConfigured();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          <Button asChild variant="inverse" size="lg">
            <Link href="/">Home</Link>
          </Button>
        }
      />
      <main className="grid min-h-[calc(100dvh-88px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[52px]">
            Sign in to draw.
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            {demo
              ? "Local demo — no Supabase. Production uses invited email magic links."
              : "Trace halls, bind sponsors, publish a map the attendee app can embed."}
          </p>
          <div className="mt-10">
            <LoginForm demo={demo} />
          </div>
        </div>
        <div className="hidden overflow-hidden p-6 lg:block">
          <div className="h-full min-h-[480px] overflow-hidden rounded-[28px] border border-border">
            <HallSchematic kind="hall" className="h-full w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
