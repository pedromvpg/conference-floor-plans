export type StudioSection = "studio" | "booths" | "stages" | "sponsors" | "agenda" | "library" | "users" | "settings" | "designer";

export function studioNavItems(slug: string) {
  return [
    { id: "studio" as const, href: `/e/${slug}/studio`, label: "Event" },
    { id: "booths" as const, href: `/e/${slug}/booths`, label: "Booths" },
    { id: "stages" as const, href: `/e/${slug}/stages`, label: "Stages" },
    { id: "sponsors" as const, href: `/e/${slug}/sponsors`, label: "Sponsors" },
    { id: "agenda" as const, href: `/e/${slug}/agenda`, label: "Agenda" },
    { id: "library" as const, href: `/e/${slug}/library`, label: "Library" },
    { id: "users" as const, href: `/e/${slug}/users`, label: "Users" },
    { id: "settings" as const, href: `/e/${slug}/settings`, label: "Settings" },
    { id: "designer" as const, href: `/e/${slug}/edit`, label: "Designer" },
  ];
}

export function eventStudioHref(slug: string) {
  return `/e/${slug}/studio`;
}
