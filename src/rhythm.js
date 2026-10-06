// Learns when you usually arrive. An arrival is the first presence after at least half an
// hour away. Stored as [localDay, minuteOfDay] pairs, bounded, one per day per time window.
export const ARRIVAL_GAP_MS = 30 * 60_000;
export const WINDOW_MINUTES = 45;
export const MIN_DAYS = 3;
export const MAX_ARRIVALS = 40;

const DAY_MS = 86_400_000;
export const localDay = (date) => Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY_MS);
export const minuteOfDay = (date) => date.getHours() * 60 + date.getMinutes();
const gap = (a, b) => {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
};
const near = (a, b) => gap(a, b) <= WINDOW_MINUTES;

export function validArrival(entry) {
  return Array.isArray(entry) && entry.length === 2 &&
    Number.isInteger(entry[0]) && entry[0] >= 0 && entry[0] <= 1e7 &&
    Number.isInteger(entry[1]) && entry[1] >= 0 && entry[1] < 1440;
}

export function isArrival(memory, at) {
  const seen = memory?.lastSeenAt;
  if (typeof at !== "number" || !Number.isFinite(at) || typeof seen !== "number") return false;
  return seen === 0 || (at >= seen && at - seen >= ARRIVAL_GAP_MS);
}

export function recordArrival(arrivals, at) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return arrivals;
  const day = localDay(date), minute = minuteOfDay(date);
  if (arrivals.some(([d, m]) => d === day && near(m, minute))) return arrivals;
  return [...arrivals, [day, minute]].slice(-MAX_ARRIVALS);
}

// The usual arrival time near `minute`, when arrivals there span at least MIN_DAYS days.
export function usualMinute(arrivals, minute) {
  const matches = arrivals.filter(([, m]) => near(m, minute));
  if (new Set(matches.map(([d]) => d)).size < MIN_DAYS) return null;
  let x = 0, y = 0;
  for (const [, m] of matches) {
    x += Math.cos((m / 1440) * 2 * Math.PI);
    y += Math.sin((m / 1440) * 2 * Math.PI);
  }
  const angle = Math.atan2(y, x);
  return Math.round((((angle / (2 * Math.PI)) * 1440) % 1440 + 1440) % 1440);
}

export function expectedNow(memory, at) {
  return Boolean(memory?.lastSeenAt) && isArrival(memory, at) &&
    usualMinute(memory.arrivals || [], minuteOfDay(new Date(at))) !== null;
}

// Distinct usual times for display, earliest first.
export function usualTimes(arrivals) {
  const found = [];
  for (const [, m] of arrivals) {
    const usual = usualMinute(arrivals, m);
    if (usual !== null && !found.some((f) => gap(f, usual) <= WINDOW_MINUTES)) found.push(usual);
  }
  return found.sort((a, b) => a - b);
}
