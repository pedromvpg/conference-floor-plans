import type { DraftBundle } from "@/lib/types";

export type HubIssue = { href: string; label: string; detail: string };

export type HubFloorRow = {
  id: string;
  name: string;
  underlay: boolean;
  scaled: boolean;
  booths: number;
  bound: number;
};

function when(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hubModel(draft: DraftBundle, airtableLoaded: boolean) {
  const { event, floors, objects, sponsors, sessions, speakers, assets, publication } = draft;
  const booths = objects.filter((o) => o.kind === "booth");
  const boundBooths = booths.filter((o) => o.sponsorId);
  const logos = sponsors.filter((s) => s.logoUrl || s.logoWhiteUrl);
  const draftStamp = Math.max(
    Date.parse(event.updatedAt),
    ...floors.map((f) => Date.parse(f.updatedAt)),
    ...objects.map((o) => Date.parse(o.updatedAt)),
    0,
  );
  const publishedAt = publication?.publishedAt ?? null;
  const liveIsStale = Boolean(publishedAt && draftStamp > Date.parse(publishedAt) + 2000);

  const floorRows: HubFloorRow[] = floors
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((floor) => {
      const floorBooths = booths.filter((o) => o.floorId === floor.id);
      return {
        id: floor.id,
        name: floor.name,
        underlay: Boolean(floor.underlayUrl),
        scaled: Boolean(floor.calibration?.metersPerPixel),
        booths: floorBooths.length,
        bound: floorBooths.filter((o) => o.sponsorId).length,
      };
    });

  const issues: HubIssue[] = [];
  if (!airtableLoaded) {
    issues.push({
      href: `/e/${event.slug}/settings`,
      label: "Airtable env missing",
      detail: "Add the screens CONF_ JSON so sponsor and agenda sync can run.",
    });
  }
  if (!floors.length) {
    issues.push({
      href: `/e/${event.slug}/edit`,
      label: "No floors",
      detail: "Add a named plan in the designer before drawing booths.",
    });
  }
  for (const floor of floorRows) {
    if (!floor.underlay) {
      issues.push({
        href: `/e/${event.slug}/edit`,
        label: `${floor.name} has no underlay`,
        detail: "Import a PDF, PNG, or SVG so scale and tracing have a source.",
      });
    } else if (!floor.scaled) {
      issues.push({
        href: `/e/${event.slug}/edit`,
        label: `${floor.name} is not scaled`,
        detail: "Two-click Scale with a known length so units are metres or feet.",
      });
    }
  }
  if (!publication) {
    issues.push({
      href: `/e/${event.slug}/edit`,
      label: "Not published",
      detail: "Attendees still see an empty viewer until you publish a snapshot.",
    });
  } else if (liveIsStale) {
    issues.push({
      href: `/e/${event.slug}/edit`,
      label: "Live snapshot is behind the draft",
      detail: `Last publish ${when(publishedAt)}. Re-publish so the viewer matches the canvas.`,
    });
  }
  if (sponsors.length && logos.length === 0) {
    issues.push({
      href: `/e/${event.slug}/sponsors`,
      label: "No logos cached",
      detail: `${sponsors.length} sponsor records, none with a file. Run cache on Sponsors.`,
    });
  }
  if (booths.length && boundBooths.length === 0 && sponsors.length) {
    issues.push({
      href: `/e/${event.slug}/edit`,
      label: "No booths bound to sponsors",
      detail: `${booths.length} booths on the plan, none linked to an Airtable record.`,
    });
  }
  if (sessions.length && speakers.length === 0) {
    issues.push({
      href: `/e/${event.slug}/agenda`,
      label: "Sessions without speakers",
      detail: `${sessions.length} sessions cached, speaker table empty. Sync speakers on Agenda.`,
    });
  }

  return {
    published: Boolean(publication),
    publishedAt,
    publishedBy: publication?.publishedBy ?? null,
    liveIsStale,
    publishedLabel: publication ? `Published ${when(publishedAt)}` : "Draft only",
    floors: floorRows,
    counts: {
      floors: floors.length,
      booths: booths.length,
      bound: boundBooths.length,
      sponsors: sponsors.length,
      logos: logos.length,
      sessions: sessions.length,
      speakers: speakers.length,
      assets: assets.length,
    },
    sync: {
      sponsors: when(event.sponsorsSyncedAt),
      agenda: when(event.agendaSyncedAt),
      speakers: when(event.speakersSyncedAt),
    },
    issues,
  };
}
