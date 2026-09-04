import { LoginForm } from "@/components/auth/LoginForm";
import { ThemeToggle } from "@/components/theme-toggle";
import { isSupabaseConfigured } from "@/lib/store";

export default function LoginPage() {
  const demo = !isSupabaseConfigured();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="mb-10 max-w-md text-left">
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
          <span className="text-primary">$</span> <span className="text-muted-foreground">auth</span>{" "}
          <span className="text-foreground">conference-maps</span>
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Designer</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Trace halls, bind sponsors, publish a map the attendee app can embed.
        </p>
      </div>
      <LoginForm demo={demo} />
    </main>
  );
}
