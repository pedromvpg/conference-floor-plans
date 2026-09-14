export function SectionLabel({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
      <p className="flex items-center gap-2 text-[13px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        {children}
      </p>
      {trailing ? <p className="text-sm text-muted-foreground/80">{trailing}</p> : null}
    </div>
  );
}
