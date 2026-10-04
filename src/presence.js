export const WELCOME_ABSENCE_MS = 60_000;
export const GREETING_COOLDOWN_MS = 300_000;

const timestamp = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

// A first visit has no lastSeenAt. Bad or future clocks never manufacture a welcome.
// Call before recording the new presence, then save lastGreetingAt only if accepted.
export function shouldGreet(memory, now = Date.now()) {
  const seen = memory?.lastSeenAt;
  const greeted = memory?.lastGreetingAt;
  if (!timestamp(now) || !timestamp(seen) || !timestamp(greeted) || seen === 0) return false;
  if (seen > now || greeted > now) return false;
  return now - seen >= WELCOME_ABSENCE_MS && (greeted === 0 || now - greeted >= GREETING_COOLDOWN_MS);
}
