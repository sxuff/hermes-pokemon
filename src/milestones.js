// Days together, counted in local calendar days from the first meeting. Day 30, day 100, then
// every yearly anniversary. A milestone is celebrated once, and only within a week of the day,
// so returning after a long break never replays stale celebrations.
import { localDay } from "./rhythm.js";

export const CELEBRATE_WITHIN = 7;

export function daysTogether(metAt, at) {
  if (!metAt || !Number.isFinite(metAt) || !Number.isFinite(at) || at < metAt) return 0;
  return localDay(new Date(at)) - localDay(new Date(metAt));
}

export function milestonesUpTo(days) {
  const result = [30, 100].filter((d) => d <= days);
  for (let year = 365; year <= days; year += 365) result.push(year);
  return result;
}

// Returns { celebrate, celebrated } where `celebrate` is the milestone to celebrate now (or null)
// and `celebrated` is the full list to store. Older uncelebrated milestones are marked silently.
export function dueMilestone(metAt, celebrated, at) {
  const days = daysTogether(metAt, at);
  const reached = milestonesUpTo(days);
  const fresh = reached.filter((d) => !celebrated.includes(d));
  if (!fresh.length) return { celebrate: null, celebrated, days };
  const latest = fresh[fresh.length - 1];
  return { celebrate: days - latest <= CELEBRATE_WITHIN ? latest : null, celebrated: [...celebrated, ...fresh].sort((a, b) => a - b), days };
}

export function milestoneName(days) {
  if (days >= 365 && days % 365 === 0) return days === 365 ? "One year together" : `${days / 365} years together`;
  return `${days} days together`;
}
