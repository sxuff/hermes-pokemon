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

// Milestones leave something permanent in the garden: a bench at day 30, a paper lantern at day
// 100 that glows after dark, and bunting on the fence from the first anniversary. Earned from
// the milestone list already saved, so nothing new is stored and nothing is ever lost.
export const REWARDS = {
  bench: { label: "A garden bench", days: 30, x: 104, y: 43 },
  lantern: { label: "A paper lantern", days: 100, x: 65, y: 43 },
  bunting: { label: "Anniversary bunting", days: 365 },
};
export function rewardsFor(milestones) {
  const reached = Array.isArray(milestones) ? milestones.filter((d) => Number.isInteger(d) && d > 0) : [];
  return Object.keys(REWARDS).filter((id) => reached.some((d) => d >= REWARDS[id].days));
}

// A sapling planted after your first week grows with the days you have spent together: nothing
// to water, it just gets a little bigger each time you pass a threshold.
export const SAPLING = { x: 146, y: 43 };
export const SAPLING_STAGES = [
  { days: 7, label: "A sprout by the fence" },
  { days: 14, label: "A young sapling" },
  { days: 60, label: "A small tree" },
  { days: 200, label: "A leafy tree" },
  { days: 365, label: "A tree that blossoms each spring" },
];
export function saplingStage(days) {
  if (!Number.isFinite(days) || days < 0) return 0;
  let stage = 0;
  for (const s of SAPLING_STAGES) if (days >= s.days) stage++;
  return stage;
}
export const saplingLabel = (stage) => SAPLING_STAGES[stage - 1]?.label ?? null;

// Away for a week or more, and a few leaves gather by the path. Your first interaction scatters
// them: a sign of time passed, never a chore. Sizes 1 to 3 for a week, two weeks and a month.
export const PILE = { x: 60, y: 109 };
export function untidyFor(daysAway) {
  if (!Number.isFinite(daysAway) || daysAway < 7) return 0;
  return daysAway >= 30 ? 3 : daysAway >= 14 ? 2 : 1;
}
