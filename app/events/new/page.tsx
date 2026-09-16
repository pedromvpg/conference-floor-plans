import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { NewEventForm } from "@/components/events/NewEventForm";
import { Button } from "@/components/ui/button";

export default async function NewEventPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/events");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          <Button asChild variant="glass" size="lg">
            <Link href="/events">Back</Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em]">New event.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">A name and slug. You import the floor after the event exists.</p>
        <div className="mt-10">
          <NewEventForm />
        </div>
      </main>
    </div>
  );
}
