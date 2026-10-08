import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SPECIES, FORMS, formFor } from "./species.js";
import { Companion } from "./behavior.js";
import { mountCanvas } from "./runtime.js";
import { loadSprites } from "./renderer.js";
import { SKIES } from "./persistence.js";
import { inPond, onTree, SPOTS } from "./world.js";
import { createCompanionMemory } from "./companion-memory.js";
import { levelFromXp, evolutionLevel, canEvolve, XP_PER_LEVEL, LEVEL_MAX } from "./progression.js";
import { SEASON_SETTINGS, SEASON_NAMES, resolveSeason } from "./seasons.js";
import { KEEPSAKES, KEEPSAKE_COUNT, MAX_PLACED } from "./keepsakes.js";
import { WEATHER_SETTINGS, resolveWeather } from "./weather.js";
import { daysTogether, milestoneName, rewardsFor, REWARDS, saplingStage, saplingLabel, untidyFor } from "./milestones.js";
import { usualTimes } from "./rhythm.js";
import { TARGETS, keyboardAction, announce, targetAt, hintFor, CURSORS } from "./keyboard.js";
import { saveSnapshot } from "./snapshot.js";
import { VISITORS } from "./visitors.js";

function Growth({ species, progress, pet, ready, ctx, bridge, reduced, onEvolve }) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const level = levelFromXp(progress.xp);
  const form = FORMS[formFor(species, progress.stage)];
  const targetLevel = evolutionLevel(species, progress.stage);
  const next = targetLevel === null ? null : FORMS[formFor(species, progress.stage + 1)];
  const eligible = canEvolve(species, progress);
  const previous = useRef({ species, level, stage: progress.stage });
  useEffect(() => {
    const before = previous.current;
    previous.current = { species, level, stage: progress.stage };
    setConfirming(false);
    const text = before.species !== species ? "" : progress.stage > before.stage
      ? `Evolved into ${form.name}! A new chapter together.`
      : level > before.level ? `Level ${level}! Growing together.` : "";
    setNotice(text);
    if (!text) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [species, level, progress.stage, form.name]);
  return <section className="hp-growth" aria-label="Companion growth">
    <div className="hp-growth-line"><span>{form.name} <strong>Lv. {level}</strong></span>
      <span>{level === LEVEL_MAX ? "Max level" : `${progress.xp % XP_PER_LEVEL} / ${XP_PER_LEVEL} XP`}</span></div>
    <progress aria-label="Experience toward next level" max={XP_PER_LEVEL} value={level === LEVEL_MAX ? XP_PER_LEVEL : progress.xp % XP_PER_LEVEL} />
    {notice && <p className="hp-growth-notice" role="status">{notice}</p>}
    {level === LEVEL_MAX && <p className="hp-ribbon"><Icon name="ribbon" size={14} /><span>Fully grown. A ribbon for the whole journey together.</span></p>}
    {eligible && !confirming && <button className="hp-evolve-offer" disabled={!ready || pet.evolving} onClick={() => setConfirming(true)}>
      {pet.evolving ? "Growing into something new…" : `Ready to evolve into ${next.name}`}<Icon name="arrow" size={14} />
    </button>}
    {confirming && eligible && <div className="hp-evolution-choice">
      <SpritePreview species={next.id} ctx={ctx} bridge={bridge} reduced={reduced} selected={false} />
      <p><strong>A new chapter?</strong><br />{form.name} → {next.name}</p>
      <small>Your nickname, memories and XP stay. You can also keep this form for as long as you like.</small>
      <div className="hp-evolution-actions"><button className="hp-small-primary" disabled={!ready || !pet.canEvolve} onClick={() => { if (onEvolve()) setConfirming(false); }}>Evolve into {next.name}</button>
        <button onClick={() => setConfirming(false)}>Not now</button></div>
      {!pet.canEvolve && <small>Let this little moment finish first. A gentle pet can wake a sleeping friend.</small>}
    </div>}
    <details className="hp-growth-help"><summary>How we grow</summary>
      <p>Every minute together earns 3 XP while this garden is visible and Hermes has focus. Pet +2, fetch +8, berry +5, and calling or exploring +2 XP.</p>
      <p>Petting and exploring earn XP once every 30 seconds; fetch and berries once a minute. A level takes 30 XP. No XP is lost while you’re away.</p>
      <p>{next ? `${next.name} becomes available at level ${targetLevel}. Evolution is always your choice.` : "Fully evolved. There’s still plenty of garden to enjoy."} Growth continues up to level {LEVEL_MAX}.</p>
    </details>
  </section>;
}

const SPOT_NAMES = { shade: "Under the old tree", sun: "The sunny patch", bank: "Beside the pond", flowers: "By the flowers", meadow: "The quiet meadow" };
const MOMENT_NAMES = { pet: "A little affection", ball: "A game of fetch", berry: "A berry shared", call: "Coming over to see you", greeting: "A welcome-back hello" };
function MemoryNote({ memory, onPlace }) {
  const moment = memory.lastInteraction;
  const usual = usualTimes(memory.arrivals || []);
  const rewards = rewardsFor(memory.milestones);
  const seen = Object.entries(memory.sightings || {}).sort((a, b) => b[1].count - a[1].count);
  const days = memory.metAt ? daysTogether(memory.metAt, Date.now()) : 0;
  const clock = (m) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60));
  return <div className="hp-memories" aria-label="Little things remembered">
    <span className="hp-eyebrow">LITTLE THINGS REMEMBERED</span>
    <dl><div><dt>Favorite nap spot</dt><dd>{SPOT_NAMES[memory.favoriteSpot] || "Still finding a favorite"}</dd></div>
      <div><dt>Last time together</dt><dd>{moment ? MOMENT_NAMES[moment.kind] : "Our story is just starting"}
        {moment && <time dateTime={new Date(moment.at).toISOString()}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(moment.at)}</time>}
      </dd></div>
      <div><dt>Usually see you</dt><dd>{usual.length ? usual.map(clock).join(" · ") : "Still learning your rhythm"}</dd></div>
      <div><dt>Days together</dt><dd>{memory.metAt ? daysTogether(memory.metAt, Date.now()) : 0}
        {memory.milestones.length > 0 && <small> · {milestoneName(memory.milestones.at(-1))} celebrated</small>}</dd></div>
      <div><dt>In the garden</dt><dd>{[...rewards.map((id) => REWARDS[id].label), saplingLabel(saplingStage(days))].filter(Boolean).join(" · ") || "A sprout after the first week, a bench on day 30, a lantern on day 100, bunting each anniversary"}</dd></div>
      <div><dt>Visitors seen</dt><dd>{seen.length
        ? seen.map(([id, s]) => `${VISITORS[id].name} ×${s.count}`).join(" · ")
        : "None yet. Wild Pokémon stop by now and then"}
        {seen.length > 0 && <small> · first {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(Math.min(...seen.map(([, s]) => s.firstAt)))}</small>}</dd></div></dl>
    <div className="hp-keepsakes" aria-label="Keepsakes found together">
      <span className="hp-label">Keepsakes <small>{memory.keepsakes.length} / {KEEPSAKE_COUNT}</small></span>
      {memory.keepsakes.length
        ? <ul>{memory.keepsakes.map((id) => {
            const out = memory.placed.includes(id);
            const full = !out && memory.placed.length >= MAX_PLACED;
            return <li key={id}>{KEEPSAKES[id].label}
              <button type="button" className="hp-place" aria-pressed={out} disabled={full} onClick={() => onPlace?.(id)}
                title={full ? `Up to ${MAX_PLACED} can be in the garden at once` : undefined}>{out ? "In the garden" : "Place"}</button></li>;
          })}</ul>
        : <small>Nothing yet. Little things turn up when you explore the tree, pond and flowers together.</small>}
    </div>
    <p>A familiar place and a few shared moments. No chores to keep up with.</p>
  </div>;
}

export function Icon({ name, size = 18 }) {
  const paths = {
    leaf: (
      <>
        <path d="M19 4C10 2 3 8 6 14s12 2 13-10Z" />
        <path d="m4 20 10-11" />
      </>
    ),
    heart: <path d="M20 5c-3-3-6-1-8 1C9 2 3 3 3 8c0 5 9 11 9 11s9-6 9-11c0-1 0-2-1-3Z" />,
    ball: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h5m6 0h5" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    berry: (
      <>
        <circle cx="12" cy="14" r="6.5" />
        <path d="M12 7.5c0-2 1-3.5 3-4.5M12 7.5C10 5 7.5 4.5 6 5c.5 2 2.5 3 6 2.5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7M4 12h12" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <path d="M4 9a8 8 0 1 1 0 6M4 3v6h6" />,
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    ribbon: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="m9 13-2 8 5-3 5 3-2-8" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
function useSignal(value) {
  return useSyncExternalStore(value.subscribe, value.get, value.get);
}
function useReduced(record, ctx) {
  const [system, setSystem] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(media.matches);
    media.addEventListener("change", update);
    const cleanup = () => media.removeEventListener("change", update);
    ctx.runtimes.add(cleanup);
    return () => {
      cleanup();
      ctx.runtimes.delete(cleanup);
    };
  }, [ctx]);
  return record.motion === "reduced" || system;
}
function SpritePreview({ species, ctx, bridge, reduced, selected }) {
  const ref = useRef(),
    motion = useRef(reduced),
    chosen = useRef(selected);
  motion.current = reduced;
  chosen.current = selected;
  const [error, setError] = useState("");
  useEffect(
    () =>
      mountCanvas({
        canvas: ref.current,
        species,
        ctx,
        bridge,
        reduced: () => motion.current,
        selected: () => chosen.current,
        onError: setError,
      }).dispose,
    [species, ctx, bridge],
  );
  return error ? (
    <span>Preview unavailable</span>
  ) : (
    <canvas ref={ref} className="hp-preview" width="100" height="88" aria-hidden="true" />
  );
}
function Choice({ record, store, save, ctx, bridge, reduced, onCancel }) {
  const [selected, setSelected] = useState(record.species || "bulbasaur");
  const [name, setName] = useState(record.nickname || "");
  return (
    <form
      className="hp-choice"
      onSubmit={(e) => {
        e.preventDefault();
        save({ species: selected, nickname: name });
        onCancel?.();
      }}
    >
      <div className="hp-intro">
        <span className="hp-eyebrow">A LITTLE COMPANY</span>
        <h2>
          Every day is better
          <br />
          with a friend.
        </h2>
        <p>
          Pick a companion. Make a little room
          <br />
          for a little adventure.
        </p>
      </div>
      <div className="hp-starters" role="group" aria-label="Choose your starter">
        {Object.entries(SPECIES).map(([id, s]) => (
          <button
            key={id}
            type="button"
            className={`hp-card hp-${id}`}
            aria-pressed={selected === id}
            onClick={() => {
              setSelected(id);
              if (selected !== id) setName("");
            }}
          >
            <span className="hp-number">No. {s.number}</span>
            <span className="hp-choice-dot" />
            <SpritePreview species={formFor(id, store.getProgression(id).stage)} ctx={ctx} bridge={bridge} reduced={reduced} selected={selected === id} />
            <strong>{s.name}</strong>
            <span className="hp-type">{s.type}</span>
            {store.getProgression(id).xp > 0 && <small className="hp-card-level">Lv. {levelFromXp(store.getProgression(id).xp)}{levelFromXp(store.getProgression(id).xp) === LEVEL_MAX ? <Icon name="ribbon" size={11} /> : null}</small>}
          </button>
        ))}
      </div>
      <p className="hp-trait">
        {SPECIES[selected].trait}
        <span>{SPECIES[selected].detail}</span>
      </p>
      <label className="hp-label" htmlFor="hp-nickname">
        A name for your new friend <span>optional</span>
      </label>
      <input
        id="hp-nickname"
        value={name}
        maxLength={24}
        autoComplete="off"
        placeholder={SPECIES[selected].name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="hp-primary" type="submit">
        {record.species ? "Welcome to the garden" : "Meet your companion"}
        <Icon name="arrow" size={17} />
      </button>
      {onCancel && (
        <button className="hp-text-button" type="button" onClick={onCancel}>
          Keep my current companion
        </button>
      )}
      <p className="hp-fine">Each starter keeps its own XP and evolution.</p>
    </form>
  );
}
function Settings({ record, store, onClose, onChange, onSnapshot, pet }) {
  const [name, setName] = useState(record.nickname);
  const [saved, setSaved] = useState("");
  const first = useRef();
  useEffect(() => first.current?.focus(), []);
  return (
    <div
      className="hp-settings"
      role="region"
      aria-label="Companion settings"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="hp-section-title">
        <h3>A little housekeeping</h3>
        <button className="hp-icon-button" aria-label="Close settings" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          store.update({ nickname: name });
          onClose();
        }}
      >
        <label className="hp-label" htmlFor="hp-rename">
          Nickname
        </label>
        <div className="hp-input-row">
          <input ref={first} id="hp-rename" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="hp-small-primary">
            Save
          </button>
        </div>
      </form>
      <div className="hp-sky">
        <span className="hp-label">Garden light</span>
        <div className="hp-segmented" role="radiogroup" aria-label="Garden light">
          {SKIES.map((sky) => (
            <button key={sky} type="button" role="radio" aria-checked={record.sky === sky} onClick={() => store.update({ sky })}>
              {sky === "auto" ? "Clock" : sky[0].toUpperCase() + sky.slice(1)}
            </button>
          ))}
        </div>
        <small>Clock follows your local time — dawn, day, dusk and a starry night. Days run long in summer and short in winter, and the moon keeps its real phase.</small>
      </div>
      <div className="hp-sky hp-season">
        <span className="hp-label">Garden season</span>
        <div className="hp-segmented" role="radiogroup" aria-label="Garden season">
          {SEASON_SETTINGS.map((season) => (
            <button key={season} type="button" role="radio" aria-checked={record.season === season} onClick={() => store.update({ season })}>
              {season === "auto" ? "Calendar" : SEASON_NAMES[season]}
            </button>
          ))}
        </div>
        <small>
          Calendar follows today’s date{record.season === "auto" ? ` (now ${SEASON_NAMES[resolveSeason("auto", record.hemisphere)].toLowerCase()})` : ""}.
        </small>
        <label className="hp-hemisphere">
          <input type="checkbox" checked={record.hemisphere === "south"} onChange={(e) => store.update({ hemisphere: e.target.checked ? "south" : "north" })} />
          <span>Southern Hemisphere seasons</span>
        </label>
      </div>
      <div className="hp-sky hp-weather">
        <span className="hp-label">Garden weather</span>
        <div className="hp-segmented" role="radiogroup" aria-label="Garden weather">
          {WEATHER_SETTINGS.map((weather) => (
            <button key={weather} type="button" role="radio" aria-checked={record.weather === weather} onClick={() => store.update({ weather })}>
              {{ auto: "Natural", clear: "Clear", rain: "Rain" }[weather]}
            </button>
          ))}
        </div>
        <small>Natural brings a few short showers on some days, a few minutes each, picked from the date. No weather service{record.weather === "auto" ? ` (right now: ${resolveWeather("auto", resolveSeason(record.season, record.hemisphere)) === "rain" ? "a shower" : "clear"})` : ""}.</small>
      </div>
      <label className="hp-motion">
        <input
          type="checkbox"
          checked={record.motion === "reduced"}
          onChange={(e) => store.update({ motion: e.target.checked ? "reduced" : "system" })}
        />
        <span>
          Extra quiet mode
          <small>Still sprites and gentler play. Your system’s reduced-motion preference is always respected.</small>
        </span>
      </label>
      <button
        className="hp-setting-action"
        onClick={() => {
          pet.reset();
          onClose();
        }}
      >
        <Icon name="reset" />
        Reset position
      </button>
      <button className="hp-setting-action" onClick={onChange}>
        <Icon name="leaf" />
        Change starter
        <Icon name="arrow" size={15} />
      </button>
      <button className="hp-setting-action" onClick={() => { const name = onSnapshot?.(); if (name) setSaved(name); }}>
        <Icon name="camera" />
        Save a snapshot
      </button>
      {saved && <p className="hp-fine" role="status">Saved {saved} to your downloads.</p>}
      <MemoryNote memory={store.getMemory(record.species)} onPlace={(id) => store.togglePlaced(record.species, id)} />
      <p className="hp-fine">
        Sprites: CHUNSOFT + SpriteCollab contributors.
        <br />
        Pokémon © Nintendo / Creatures / GAME FREAK.
        <br />
        Independent fan project · v{__VERSION__}
      </p>
    </div>
  );
}
function Habitat({ record, store, ctx, bridge, reduced, onChange }) {
  const canvas = useRef(),
    motion = useRef(reduced),
    sky = useRef(record.sky),
    season = useRef({ setting: record.season, hemisphere: record.hemisphere }),
    weather = useRef(record.weather),
    placed = useRef([]),
    rewards = useRef([]),
    focusTarget = useRef(null),
    cameos = useRef([]),
    days = useRef(0),
    runtime = useRef(),
    settingsButton = useRef(),
    evolutionPosition = useRef();
  motion.current = reduced;
  sky.current = record.sky;
  season.current = { setting: record.season, hemisphere: record.hemisphere };
  weather.current = record.weather;
  placed.current = store.getMemory(record.species).placed;
  rewards.current = rewardsFor(store.getMemory(record.species).milestones);
  days.current = store.getMemory(record.species).metAt ? daysTogether(store.getMemory(record.species).metAt, Date.now()) : 0;
  // Starters you have met before may drop by for a cameo, at the form they have reached.
  cameos.current = Object.keys(SPECIES)
    .filter((lineage) => lineage !== record.species && store.getMemory(lineage).metAt > 0)
    .map((lineage) => ({ lineage, form: formFor(lineage, store.getProgression(lineage).stage), name: SPECIES[lineage].name }));
  const progress = store.getProgression(record.species);
  const form = formFor(record.species, progress.stage);
  const pet = useMemo(() => new Companion(record.species, Math.random, {
    favoriteSpot: store.getMemory(record.species).favoriteSpot, form,
    keepsakes: store.getMemory(record.species).keepsakes,
    placed: store.getMemory(record.species).placed,
    season: resolveSeason(record.season, record.hemisphere),
    position: evolutionPosition.current?.species === record.species ? evolutionPosition.current : undefined,
    // Away a week or more: a few leaves have gathered by the path, until the first interaction.
    untidy: evolutionPosition.current?.species === record.species ? 0
      : untidyFor(store.getMemory(record.species).lastSeenAt ? (Date.now() - store.getMemory(record.species).lastSeenAt) / 86_400_000 : 0),
  }), [record.species, form, store]);
  const memory = useRef();
  const snapshot = () => ({ caption: pet.caption, busy: pet.busy, fetching: pet.fetching, evolving: pet.evolving, canEvolve: pet.canEvolve });
  const [status, setStatus] = useState(snapshot);
  // What the status bar and palette commands see while this garden is mounted.
  const publish = () => ctx.live?.set({ pet, species: record.species, form, nickname: record.nickname, caption: pet.caption });
  useEffect(() => {
    publish();
    return () => { if (ctx.live?.get()?.pet === pet) ctx.live.set(null); };
  }, [pet, record.nickname, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const [settings, setSettings] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [focused, setFocused] = useState(null),
    [hover, setHover] = useState(null);
  useEffect(() => {
    setReady(false);
    setError("");
    setStatus(snapshot());
    evolutionPosition.current = undefined;
    const controller = createCompanionMemory({ store, species: record.species, pet });
    memory.current = controller;
    runtime.current = mountCanvas({
      canvas: canvas.current,
      ctx,
      bridge,
      pet,
      species: record.species,
      form,
      reduced: () => motion.current,
      sky: () => sky.current,
      season: () => season.current,
      weather: () => weather.current,
      placed: () => placed.current,
      rewards: () => rewards.current,
      focus: () => focusTarget.current,
      cameos: () => cameos.current,
      days: () => days.current,
      memory: controller,
      onReady: () => setReady(true),
      onError: setError,
      onStatus: () => { setStatus(snapshot()); publish(); },
      onEvolutionComplete: (position) => {
        evolutionPosition.current = { ...position, species: record.species };
        store.evolve(record.species);
      },
    });
    const mounted = runtime.current;
    return () => {
      mounted.dispose();
      if (memory.current === controller) memory.current = undefined;
    };
  }, [pet, record.species, form, ctx, bridge, store]);
  // Opt-in development handle (set by the browser demo only); nothing is exposed in Hermes.
  useEffect(() => {
    const debug = globalThis.__hermesPokemonDebug;
    if (debug && typeof debug === "object") { debug.pet = pet; debug.runtime = () => runtime.current; }
    return () => { if (debug?.pet === pet) delete debug.pet; };
  }, [pet]);
  // A new sky preference should show immediately, not at the next periodic check.
  const placedKey = placed.current.join(","), rewardsKey = rewards.current.join(","), sapling = saplingStage(days.current);
  useEffect(() => runtime.current?.refresh(), [record.sky, record.season, record.hemisphere, record.weather, placedKey, rewardsKey, sapling]);
  const closeSettings = () => {
    setSettings(false);
    settingsButton.current?.focus();
  };
  const act = (fn) => () => {
    fn();
    memory.current?.flush();
    setStatus(snapshot());
  };
  // One dispatch for clicks and keyboard activation: a point in the garden, and whether it is
  // the companion itself.
  function actAt(p, id) {
    // While Hermes has a question, tapping the companion also puts the caret in the composer.
    if (id === "companion" && pet.state === "waiting") bridge.focusComposer?.();
    if (id === "companion") pet.pet();
    else if (id === "tree") { pet.investigate(p, "tree"); pet.emit("leaves", { x: p.x, y: p.y }); }
    else if (id === "pond") { pet.investigate(p, "pond"); pet.emit("splash", { x: p.x, y: p.y + 2 }); }
    else if (id === "flowers") pet.investigate(p, "flowers");
    else if (id === "grass") pet.callTo(p);
    else pet.notice(p);
    memory.current?.flush();
    setStatus(snapshot());
  }
  const pointAt = (event) => {
    const box = canvas.current.getBoundingClientRect();
    return runtime.current.toWorld((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  };
  function clickGarden(event) {
    if (!ready || pet.evolving) return;
    const p = pointAt(event);
    actAt(p, targetAt(p, pet, FORMS[form]));
  }
  // Hover: the cursor and the hint line say what a click here would do.
  function hoverGarden(event) {
    if (!ready) return;
    const id = targetAt(pointAt(event), pet, FORMS[form]);
    if (id !== hover) setHover(id);
  }
  // Keyboard: arrows move a focus ring between the companion and the scenery, Enter acts on it.
  const setFocus = (index) => { focusTarget.current = index; setFocused(index); };
  function keyGarden(event) {
    const action = keyboardAction(event.key, focused);
    if (!action) return;
    event.preventDefault();
    if (action.type === "clear") return setFocus(null);
    if (action.type === "move") return setFocus(action.index);
    if (!ready || pet.evolving) return;
    const target = TARGETS[action.index];
    actAt(target.point || { x: pet.x, y: pet.y }, target.id === "companion" ? "companion" : targetAt(target.point));
  }
  const s = SPECIES[record.species], currentForm = FORMS[form];
  return (
    <div className="hp-living">
      <div className="hp-scene-column">
        <div className="hp-stage">
          <canvas
            ref={canvas}
            width="640"
            height="480"
            tabIndex={0}
            style={{ cursor: CURSORS[hover] || "default" }}
            onClick={clickGarden}
            onMouseMove={hoverGarden}
            onMouseLeave={() => setHover(null)}
            onKeyDown={keyGarden}
            onFocus={() => { if (focusTarget.current === null && canvas.current?.matches?.(":focus-visible")) setFocus(0); }}
            onBlur={() => setFocus(null)}
            aria-label={`${record.nickname}, a ${currentForm.name}, in a pixel-art garden. Click the Pokémon to pet it, the grass to call it over, or the tree, pond and flowers to explore together. With the garden focused, arrow keys choose the Pokémon, tree, pond, flowers or meadow, and Enter acts on the choice.`}
          />
          <span className="hp-sr-only" aria-live="polite">{announce(focused)}</span>
          {!ready && (
            <div className="hp-loading" role="status">
              {error || "Opening the garden…"}
            </div>
          )}
        </div>
      </div>
      <div className="hp-companion-column">
        <div className="hp-name-row">
          <div>
            <h2>{record.nickname}</h2>
            <p className="hp-status" role="status" aria-live="polite">
              {status.caption}
            </p>
          </div>
          <span className={`hp-badge hp-${record.species}`}>{currentForm.type}</span>
        </div>
        <div className="hp-controls">
          <button disabled={!ready || status.evolving} onClick={act(() => pet.pet())} title="Pet" aria-label="Pet">
            <Icon name="heart" />
            <span>Pet</span>
          </button>
          <button disabled={!ready || status.busy} onClick={act(() => pet.throwBall())} title="Throw ball" aria-label="Throw ball">
            <Icon name="ball" />
            <span>{status.fetching ? "Fetching…" : "Ball"}</span>
          </button>
          <button disabled={!ready || status.busy} onClick={act(() => pet.giveTreat())} title="Give an Oran Berry" aria-label="Give an Oran Berry">
            <Icon name="berry" />
            <span>Berry</span>
          </button>
          <button
            ref={settingsButton}
            className="hp-icon-button"
            aria-label="Companion settings"
            aria-expanded={settings}
            onClick={() => setSettings(!settings)}
          >
            <Icon name="settings" />
          </button>
        </div>
        <Growth species={record.species} progress={progress} pet={pet} ready={ready} ctx={ctx} bridge={bridge} reduced={reduced} onEvolve={() => {
          if (!canEvolve(record.species, store.getProgression(record.species))) return false;
          const accepted = pet.beginEvolution();
          setStatus(snapshot());
          return accepted;
        }} />
        {settings ? (
          <Settings record={record} store={store} pet={pet} onClose={closeSettings} onChange={onChange}
            onSnapshot={() => saveSnapshot(canvas.current, { nickname: record.nickname, form: currentForm.name, days: days.current })} />
        ) : (
          <p className="hp-hint">
            <Icon name="leaf" size={14} />
            <span>
              {hover ? hintFor(hover, record.nickname) : `${s.detail} Tap the garden to explore with ${record.nickname}.`}
            </span>
          </p>
        )}
        {reduced && <p className="hp-fine hp-motion-note">Quiet motion is on</p>}
      </div>
    </div>
  );
}
// Status-bar item: the companion's idle frame at 18px and what it is doing. Click to reveal the
// pane. Renders nothing until a garden is mounted, so the bar stays clean before a starter is chosen.
export function StatusItem({ live, bridge }) {
  const state = useSignal(live);
  const visible = useSignal(bridge.visible);
  const ref = useRef();
  const form = state?.form;
  useEffect(() => {
    if (!form || !ref.current) return;
    let cancelled = false;
    loadSprites(form).then((sprites) => {
      const canvas = ref.current;
      if (cancelled || !canvas) return;
      const a = sprites.Idle, scale = Math.min(18 / a.height, 18 / a.width);
      canvas.width = 18; canvas.height = 18;
      const c = canvas.getContext("2d");
      c.imageSmoothingEnabled = false;
      const w = Math.round(a.width * scale), h = Math.round(a.height * scale);
      c.drawImage(a.image, 0, 0, a.width, a.height, Math.floor((18 - w) / 2), 18 - h, w, h);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [form]);
  if (!state) return null;
  const caption = visible ? state.caption : "Resting while hidden";
  return (
    <button type="button" className="hp-statusbar" title={`${state.nickname}: ${caption}. Click to show the garden.`} aria-label={`${state.nickname}: ${caption}. Show the garden.`} onClick={() => bridge.revealPane?.()}>
      <canvas ref={ref} aria-hidden="true" />
      <span><strong>{state.nickname}</strong>{caption}</span>
    </button>
  );
}
export function App({ store, ctx, bridge }) {
  const { record, warning } = useSignal(store);
  const [choosing, setChoosing] = useState(false);
  const reduced = useReduced(record, ctx);
  const visible = useSignal(bridge.visible);
  return (
    <section className="hp-root" aria-label="Hermes Pokémon" data-visible={visible}>
      <header className="hp-header">
        <span className="hp-brand-icon">
          <Icon name="leaf" size={16} />
        </span>
        <span>
          Hermes <strong>Pokémon</strong>
        </span>
        <span className="hp-version">v{__VERSION__.split(".").slice(0, 2).join(".")}</span>
      </header>
      <div className="hp-scroll">
        {!record.species || choosing ? (
          <Choice
            record={record}
            store={store}
            ctx={ctx}
            bridge={bridge}
            reduced={reduced}
            save={(patch) => store.update(patch)}
            onCancel={record.species ? () => setChoosing(false) : undefined}
          />
        ) : (
          <Habitat
            record={record}
            store={store}
            ctx={ctx}
            bridge={bridge}
            reduced={reduced}
            onChange={() => setChoosing(true)}
          />
        )}
        {warning && (
          <p className="hp-warning" role="alert">
            {warning}
          </p>
        )}
      </div>
      <footer className="hp-footer">
        <span>
          <i />
          {visible ? "A little world of your own" : "Resting while hidden"}
        </span>
        <span>EST. KANTO</span>
      </footer>
    </section>
  );
}
