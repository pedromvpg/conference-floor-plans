import Link from "next/link";
import { HallSchematic } from "@/components/marketing/HallSchematic";
import { Button } from "@/components/ui/button";

export function PromoBanner({
  kind,
  cover,
  title,
  kicker,
  href,
  cta,
  secondaryHref,
  secondaryCta,
  shout = true,
  className = "min-h-[280px] sm:min-h-[380px] lg:min-h-[460px]",
}: {
  kind?: "plan" | "hall" | "walk";
  cover?: string;
  title: string;
  kicker?: string;
  href?: string;
  cta?: string;
  secondaryHref?: string;
  secondaryCta?: string;
  shout?: boolean;
  className?: string;
}) {
  return (
    <article className={`dark relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a] ${className}`}>
      {cover ? (
        <>
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <img
            src={cover}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-3xl [mask-image:linear-gradient(to_right,black,transparent_70%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent mix-blend-multiply"
          />
        </>
      ) : kind ? (
        <HallSchematic kind={kind} className="absolute inset-0 h-full w-full" />
      ) : null}
      <h2
        className={`pointer-events-none absolute top-6 left-6 max-w-[90%] font-semibold tracking-[-0.05em] text-[#fcfcfc] sm:left-8 ${
          shout ? "text-[32px] leading-[0.92] uppercase sm:text-[48px]" : "text-[28px] leading-[1.05] sm:text-[40px]"
        }`}
      >
        {title}
      </h2>
      <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
        {kicker ? (
          <span className="rounded-full border border-white/15 bg-[#0a0a0a]/80 px-4 py-2 font-mono text-[11px] tracking-wide text-white/70">
            {kicker}
          </span>
        ) : (
          <span />
        )}
        {href && cta ? (
          <div className="flex gap-2">
            {secondaryHref && secondaryCta ? (
              <Button asChild variant="glass" size="lg">
                <Link href={secondaryHref}>{secondaryCta}</Link>
              </Button>
            ) : null}
            <Button asChild variant="inverse" size="lg">
              <Link href={href}>{cta}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
