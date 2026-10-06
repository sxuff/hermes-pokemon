// Offline weather: some days drizzle. The day is chosen by a stable hash of the local date, so
// it stays the same all day and needs no network. Winter already has its snow.
import { localDay } from "./rhythm.js";

export const WEATHER_SETTINGS = ["auto", "clear", "rain"];
// Share of days with showers. A showery day has 1 to 3 short showers, never all-day rain.
export const RAIN_CHANCE = { spring: 0.2, summer: 0.12, autumn: 0.2, winter: 0 };
export const SHOWER_MINUTES = [3, 6];
const SHOWER_WINDOW = [7 * 60, 22 * 60];

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

// The day's showers as [startMinute, endMinute) pairs in local time. Same answer all day.
export function showersForDate(date, season) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return [];
  const day = localDay(date);
  if (hash(day) >= (RAIN_CHANCE[season] ?? 0)) return [];
  const count = 1 + Math.floor(hash(day * 7 + 1) * 3);
  const [from, to] = SHOWER_WINDOW, [lo, hi] = SHOWER_MINUTES;
  const showers = [];
  for (let i = 0; i < count; i++) {
    const start = from + Math.floor(hash(day * 7 + 2 + i * 2) * (to - from - hi));
    const length = lo + Math.floor(hash(day * 7 + 3 + i * 2) * (hi - lo + 1));
    showers.push([start, start + length]);
  }
  return showers.sort((a, b) => a[0] - b[0]);
}

export function weatherForDate(date, season) {
  const minute = date instanceof Date ? date.getHours() * 60 + date.getMinutes() : NaN;
  return showersForDate(date, season).some(([a, b]) => minute >= a && minute < b) ? "rain" : "clear";
}

export function resolveWeather(setting, season, date = new Date()) {
  if (setting === "clear" || setting === "rain") return setting;
  return weatherForDate(date, season);
}

// Late-night hours, local time: the companion gets sleepy.
export const LATE_START = 1, LATE_END = 5;
export const isLateNight = (date) => date instanceof Date && date.getHours() >= LATE_START && date.getHours() < LATE_END;
