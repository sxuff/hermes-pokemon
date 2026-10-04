import { SPECIES, EVOLUTION_LEVELS } from "./species.js";

export const LEVEL_START = 5;
export const LEVEL_MAX = 50;
export const XP_PER_LEVEL = 30;
export const XP_MAX = (LEVEL_MAX - LEVEL_START) * XP_PER_LEVEL;
export const INTERACTION_REWARDS = {
  pet: { xp: 2, cooldownMs: 30_000 },
  ball: { xp: 8, cooldownMs: 60_000 },
  berry: { xp: 5, cooldownMs: 60_000 },
  call: { xp: 2, cooldownMs: 30_000 },
};
export const DEFAULT_PROGRESSION = {
  xp: 0,
  stage: 0,
  rewardedAt: { pet: null, ball: null, berry: null, call: null },
  togetherSeconds: 0,
};
const knownLineage = (lineage) => typeof lineage === "string" && Object.hasOwn(SPECIES, lineage);
const timestamp = (at) => typeof at === "number" && Number.isFinite(at) && at >= 0 && at <= 8.64e15;
const cleanXp = (xp) => typeof xp === "number" && Number.isFinite(xp) ? Math.min(XP_MAX, Math.max(0, Math.floor(xp))) : 0;

export function levelFromXp(xp) {
  return LEVEL_START + Math.floor(cleanXp(xp) / XP_PER_LEVEL);
}

export function evolutionLevel(lineage, stage) {
  return knownLineage(lineage) && Number.isInteger(stage) && stage >= 0 && stage < 2 ? EVOLUTION_LEVELS[lineage][stage] : null;
}

// Lineages are the stable save keys. Earning XP never changes the consented stage.
export function progressionOf(raw, lineage) {
  if (!knownLineage(lineage)) raw = null;
  const xp = cleanXp(raw?.xp), level = levelFromXp(xp);
  let stage = Number.isInteger(raw?.stage) && raw.stage >= 0 && raw.stage <= 2 ? raw.stage : 0;
  while (stage > 0 && level < evolutionLevel(lineage, stage - 1)) stage--;
  const rewardedAt = {};
  for (const kind of Object.keys(INTERACTION_REWARDS))
    rewardedAt[kind] = timestamp(raw?.rewardedAt?.[kind]) ? raw.rewardedAt[kind] : null;
  const seconds = raw?.togetherSeconds;
  return {
    xp, stage, rewardedAt,
    togetherSeconds: xp < XP_MAX && typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 && seconds < 60 ? seconds : 0,
  };
}

export function canEvolve(lineage, raw) {
  const progress = progressionOf(raw, lineage);
  const required = evolutionLevel(lineage, progress.stage);
  return required !== null && levelFromXp(progress.xp) >= required;
}

export function rewardInteraction(raw, lineage, kind, at) {
  const progress = progressionOf(raw, lineage);
  const reward = typeof kind === "string" && Object.hasOwn(INTERACTION_REWARDS, kind) ? INTERACTION_REWARDS[kind] : null;
  if (!knownLineage(lineage) || !reward || !timestamp(at) || progress.xp === XP_MAX) return { progress, gained: 0 };
  const previous = progress.rewardedAt[kind];
  // Keep a future timestamp: a rolled-back clock must catch up before rewarding again.
  if (previous !== null && at - previous < reward.cooldownMs) return { progress, gained: 0 };
  const gained = Math.min(reward.xp, XP_MAX - progress.xp);
  progress.xp += gained;
  progress.rewardedAt[kind] = at;
  if (progress.xp === XP_MAX) progress.togetherSeconds = 0;
  return { progress, gained };
}

export function advanceTogetherTime(raw, lineage, seconds, at) {
  const progress = progressionOf(raw, lineage);
  if (!knownLineage(lineage) || !timestamp(at) || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0 || progress.xp === XP_MAX)
    return { progress, gained: 0 };
  // The caller supplies actual visible+focused simulation time, batched at most every
  // 30 seconds. Never infer elapsed time from a saved date or reward offline absence.
  const total = progress.togetherSeconds + Math.min(seconds, 30);
  const minutes = Math.floor((total + 1e-9) / 60);
  const gained = Math.min(minutes * 3, XP_MAX - progress.xp);
  progress.xp += gained;
  progress.togetherSeconds = progress.xp === XP_MAX ? 0 : Math.max(0, total - minutes * 60);
  return { progress, gained };
}
