import type { MapEvent } from "./types";

export type ResolvedAirtable = {
  sponsorsToken: string;
  agendaToken: string;
  sponsorsBaseId: string;
  sponsorsTable: string;
  agendaBaseId: string;
  agendaTable: string;
  speakersBaseId: string;
  speakersTable: string;
  eventCode: string;
  envKey: string | null;
};

/** bitcoinAsia2026 → CONF_BITCOINASIA2026, same as conference-screens. */
export function confEnvKeysForSlug(slug: string): string[] {
  if (slug === "bhk26") return ["CONF_BITCOINASIA2026", "CONF_BHK26"];
  return ["CONF_" + slug.toUpperCase().replace(/[^A-Z0-9]/g, "")];
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function candidateValues(raw: string, envKey: string): string[] {
  const trimmed = raw.trim();
  const prefix = envKey + "=";
  const withoutKeyEq = trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length).trim()
    : trimmed.replace(/^CONF_[A-Z0-9]+=/, "").trim();
  const unquoted = (s: string) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : "");
  return [trimmed, withoutKeyEq, unquoted(trimmed), unquoted(withoutKeyEq)].filter(Boolean);
}

export function parseConfJson(raw: string, envKey: string): Record<string, unknown> | null {
  const seen = new Set<string>();
  for (const candidate of candidateValues(raw, envKey)) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    let current: unknown = candidate;
    for (let i = 0; i < 3; i++) {
      if (typeof current === "string") {
        try {
          current = JSON.parse(current) as unknown;
        } catch {
          break;
        }
        continue;
      }
      if (current && typeof current === "object" && !Array.isArray(current)) {
        return current as Record<string, unknown>;
      }
      break;
    }
  }
  return null;
}

export function lookupConfEnv(slug: string): { envKey: string; conf: Record<string, unknown> } | null {
  for (const envKey of confEnvKeysForSlug(slug)) {
    const raw = process.env[envKey];
    if (!raw) continue;
    const conf = parseConfJson(raw, envKey);
    if (conf) return { envKey, conf };
  }
  return null;
}

export function resolveAirtable(event: Pick<MapEvent, "slug">): ResolvedAirtable {
  const found = lookupConfEnv(event.slug);
  const c = found?.conf ?? {};
  const agendaToken = str(c.airtableToken);
  const sponsorsToken = str(c.sponsorsToken) || agendaToken;
  const sponsorsBaseId = str(c.sponsorsBaseId);
  const agendaBaseId = str(c.agendaBaseId);
  const speakersBaseId = str(c.speakersBaseId) || agendaBaseId;
  return {
    sponsorsToken,
    agendaToken,
    sponsorsBaseId,
    sponsorsTable: str(c.sponsorsTable),
    agendaBaseId,
    agendaTable: str(c.agendaTable),
    speakersBaseId,
    speakersTable: str(c.speakersTable),
    eventCode: str(c.eventCode),
    envKey: found?.envKey ?? null,
  };
}

export function airtableEnvStatus(slug: string): { keys: string[]; loadedKey: string | null } {
  const keys = confEnvKeysForSlug(slug);
  const found = lookupConfEnv(slug);
  return { keys, loadedKey: found?.envKey ?? null };
}
