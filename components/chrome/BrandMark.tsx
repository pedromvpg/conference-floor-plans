export function BrandLockup({
  size = "md",
  on = "auto",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  on?: "auto" | "dark" | "light";
  className?: string;
}) {
  const height = size === "lg" ? "h-12 sm:h-16" : size === "sm" ? "h-8 sm:h-9" : "h-10";
  const white = `${height} w-auto ${on === "light" ? "hidden" : on === "dark" ? "block" : "hidden dark:block"}`;
  const black = `${height} w-auto ${on === "dark" ? "hidden" : on === "light" ? "block" : "block dark:hidden"}`;
  return (
    <span className={`inline-flex ${className}`}>
      <img src="/brand/wordmark-white.svg" alt="Bitcoin Conference Floor Plan" className={white} />
      <img src="/brand/wordmark-black.svg" alt="Bitcoin Conference Floor Plan" className={black} />
    </span>
  );
}
