// Offline weather: some days drizzle. The day is chosen by a stable hash of the local date, so
// it stays the same all day and needs no network. Winter already has its snow.
import { localDay } from "./rhythm.js";

export const WEATHER_SETTINGS = ["auto", "clear", "rain"];
export const RAIN_CHANCE = { spring: 0.3, summer: 0.2, autumn: 0.3, winter: 0 };

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

export function weatherForDate(date, season) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "clear";
  return hash(localDay(date)) < (RAIN_CHANCE[season] ?? 0) ? "rain" : "clear";
}

export function resolveWeather(setting, season, date = new Date()) {
  if (setting === "clear" || setting === "rain") return setting;
  return weatherForDate(date, season);
}

// Late-night hours, local time: the companion gets sleepy.
export const LATE_START = 1, LATE_END = 5;
export const isLateNight = (date) => date instanceof Date && date.getHours() >= LATE_START && date.getHours() < LATE_END;
