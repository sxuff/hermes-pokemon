// Seasons follow the local calendar (meteorological seasons: whole months), or a pinned
// choice. A device clock cannot know the hemisphere, so that is a small user setting.
export const SEASONS = ["spring", "summer", "autumn", "winter"];
export const SEASON_SETTINGS = ["auto", ...SEASONS];
export const HEMISPHERES = ["north", "south"];
const FLIP = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" };

export function seasonForDate(date, hemisphere = "north") {
  const month = date instanceof Date ? date.getMonth() : NaN;
  if (!Number.isInteger(month)) return "summer";
  const north = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "autumn" : "winter";
  return hemisphere === "south" ? FLIP[north] : north;
}

export function resolveSeason(setting, hemisphere, date = new Date()) {
  return SEASONS.includes(setting) ? setting : seasonForDate(date, hemisphere);
}

export const SEASON_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
