export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "someone";
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const hint = user.length <= 1 ? "*" : `${user[0]}…`;
  return `${hint}@${domain}`;
}

export function maskSecret(value: string | null | undefined): string {
  return value ? "••••" : "";
}
