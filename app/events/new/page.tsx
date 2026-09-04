import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewEventForm } from "@/components/events/NewEventForm";

export default async function NewEventPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <main className="px-4 py-10">
      <Link href="/events" className="chrome-kicker hover:text-primary">
        Back
      </Link>
      <div className="mt-4 mb-8 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">New event</h1>
        <ThemeToggle />
      </div>
      <NewEventForm />
    </main>
  );
}
