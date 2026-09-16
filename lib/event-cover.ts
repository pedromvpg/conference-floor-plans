export function eventCover(slug: string) {
  if (slug.includes("amsterdam")) return "/marketing/amsterdam-cover.png";
  if (slug === "bitcoin-2027") return "/marketing/bitcoin-2027-cover.png";
  if (slug === "bhk26") return "/marketing/bhk26-cover.png";
  return undefined;
}
