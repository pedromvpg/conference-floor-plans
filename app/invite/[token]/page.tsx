import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { HallSchematic } from "@/components/marketing/HallSchematic";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { Button } from "@/components/ui/button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        action={
          <Button asChild variant="inverse" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main className="grid min-h-[calc(100dvh-88px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[52px]">
            Create a password to join.
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            This invite is single-use and expires in seven days. Choose a new password now. We store only a salted
            hash — the plaintext is never kept or shown to admins.
          </p>
          <div className="mt-10">
            <AcceptInviteForm token={token} />
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
