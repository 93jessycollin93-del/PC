export function tuneBalance(energy) {
  const level = Number(energy);
  if (level <= 2) return { length: "brief", warmth: "gentle" };
  if (level >= 4) return { length: "expansive", warmth: "bright" };
  return { length: "measured", warmth: "steady" };
}
