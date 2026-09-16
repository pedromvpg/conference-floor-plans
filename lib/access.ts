export type UserRole = "admin" | "editor" | "viewer";
export type EventAccess = "editor" | "viewer";

export type AppUser = {
  email: string;
  role: UserRole;
  allEvents: boolean;
  createdAt: string;
  passwordHash?: string;
};

export type EventEditorGrant = {
  eventId: string;
  email: string;
  access: EventAccess;
};

export type InviteRecord = {
  id: string;
  tokenHash: string;
  /** Plain token kept until the invite is used so admins can recopy the URL. */
  token?: string;
  email: string;
  role: UserRole;
  eventIds: string[] | "all";
  expiresAt: string;
  usedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type CreatedInvite = InviteRecord & { token: string; url: string };

export type InviteClient = Omit<InviteRecord, "tokenHash" | "token"> & { url?: string };

export function inviteToClient(invite: InviteRecord, origin: string): InviteClient {
  const { tokenHash: _h, token, ...rest } = invite;
  const url =
    token && !invite.usedAt ? `${origin.replace(/\/$/, "")}/invite/${token}` : undefined;
  return { ...rest, url };
}

export function bootstrapAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() || process.env.ALLOWED_EMAILS?.trim() || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string): boolean {
  return bootstrapAdminEmails().includes(email.trim().toLowerCase());
}

export function grantAccess(g: Pick<EventEditorGrant, "access">): EventAccess {
  return g.access === "viewer" ? "viewer" : "editor";
}

export function parseEventAccess(value: unknown): EventAccess {
  return value === "viewer" ? "viewer" : "editor";
}

export function parseUserRole(value: unknown): UserRole {
  if (value === "admin" || value === "viewer") return value;
  return "editor";
}
