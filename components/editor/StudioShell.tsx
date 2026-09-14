export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh w-full bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
