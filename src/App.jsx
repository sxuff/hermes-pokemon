import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SPECIES } from "./species.js";
import { Companion } from "./behavior.js";
import { mountCanvas } from "./runtime.js";
import { SKIES } from "./persistence.js";
import { inPond, onTree, SPOTS } from "./world.js";
import { createCompanionMemory } from "./companion-memory.js";

const SPOT_NAMES = { shade: "Under the old tree", sun: "The sunny patch", bank: "Beside the pond", flowers: "By the flowers", meadow: "The quiet meadow" };
const MOMENT_NAMES = { pet: "A little affection", ball: "A game of fetch", berry: "A berry shared", call: "Coming over to see you", greeting: "A welcome-back hello" };
function MemoryNote({ memory }) {
  const moment = memory.lastInteraction;
  return <div className="hp-memories" aria-label="Little things remembered">
    <span className="hp-eyebrow">LITTLE THINGS REMEMBERED</span>
    <dl><div><dt>Favorite nap spot</dt><dd>{SPOT_NAMES[memory.favoriteSpot] || "Still finding a favorite"}</dd></div>
      <div><dt>Last time together</dt><dd>{moment ? MOMENT_NAMES[moment.kind] : "Our story is just starting"}
        {moment && <time dateTime={new Date(moment.at).toISOString()}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(moment.at)}</time>}
      </dd></div></dl>
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
function Choice({ record, save, ctx, bridge, reduced, onCancel }) {
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
            <SpritePreview species={id} ctx={ctx} bridge={bridge} reduced={reduced} selected={selected === id} />
            <strong>{s.name}</strong>
            <span className="hp-type">{s.type}</span>
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
      <p className="hp-fine">One small garden. A friend to share it with.</p>
    </form>
  );
}
function Settings({ record, store, onClose, onChange, pet }) {
  const [name, setName] = useState(record.nickname);
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
        <small>Clock follows your local time — dawn, day, dusk and a starry night.</small>
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
      <MemoryNote memory={store.getMemory(record.species)} />
      <p className="hp-fine">
        Sprites: CHUNSOFT via SpriteCollab.
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
    runtime = useRef(),
    settingsButton = useRef();
  motion.current = reduced;
  sky.current = record.sky;
  const pet = useMemo(() => new Companion(record.species, Math.random, { favoriteSpot: store.getMemory(record.species).favoriteSpot }), [record.species, store]);
  const memory = useRef();
  const snapshot = () => ({ caption: pet.caption, busy: pet.busy, fetching: pet.fetching });
  const [status, setStatus] = useState(snapshot);
  const [settings, setSettings] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = createCompanionMemory({ store, species: record.species, pet });
    memory.current = controller;
    runtime.current = mountCanvas({
      canvas: canvas.current,
      ctx,
      bridge,
      pet,
      species: record.species,
      reduced: () => motion.current,
      sky: () => sky.current,
      memory: controller,
      onReady: () => setReady(true),
      onError: setError,
      onStatus: () => setStatus(snapshot()),
    });
    const mounted = runtime.current;
    return () => {
      mounted.dispose();
      if (memory.current === controller) memory.current = undefined;
    };
  }, [pet, record.species, ctx, bridge, store]);
  // Opt-in development handle (set by the browser demo only); nothing is exposed in Hermes.
  useEffect(() => {
    const debug = globalThis.__hermesPokemonDebug;
    if (debug && typeof debug === "object") debug.pet = pet;
    return () => { if (debug?.pet === pet) delete debug.pet; };
  }, [pet]);
  // A new sky preference should show immediately, not at the next periodic check.
  useEffect(() => runtime.current?.refresh(), [record.sky]);
  const closeSettings = () => {
    setSettings(false);
    settingsButton.current?.focus();
  };
  const act = (fn) => () => {
    fn();
    memory.current?.flush();
    setStatus(snapshot());
  };
  function clickGarden(event) {
    const box = canvas.current.getBoundingClientRect();
    const p = runtime.current.toWorld((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    // The body sits above the feet; be generous so a quick click still pets.
    const bodyY = pet.swimming ? pet.y - 6 : pet.y - 10;
    if (Math.abs(p.x - pet.x) < 13 && Math.abs(p.y - bodyY) < 14) pet.pet();
    else if (onTree(p)) { pet.investigate(p, "tree"); pet.emit("leaves", { x: p.x, y: p.y }); }
    else if (inPond(p)) { pet.investigate(p, "pond"); pet.emit("splash", { x: p.x, y: p.y + 2 }); }
    else if (Math.hypot(p.x - SPOTS.flowers.x, p.y - SPOTS.flowers.y) < 10) pet.investigate(p, "flowers");
    else if (p.y > 44) pet.callTo(p);
    else pet.notice(p);
    memory.current?.flush();
    setStatus(snapshot());
  }
  const s = SPECIES[record.species];
  return (
    <div className="hp-living">
      <div className="hp-scene-column">
        <div className="hp-stage">
          <canvas
            ref={canvas}
            width="640"
            height="480"
            onClick={clickGarden}
            aria-label={`${record.nickname}, a ${s.name}, in a pixel-art garden. Click the Pokémon to pet it, the grass to call it over, or the tree, pond and flowers to explore together.`}
          />
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
          <span className={`hp-badge hp-${record.species}`}>{s.type}</span>
        </div>
        <div className="hp-controls">
          <button disabled={!ready} onClick={act(() => pet.pet())} title="Pet" aria-label="Pet">
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
        {settings ? (
          <Settings record={record} store={store} pet={pet} onClose={closeSettings} onChange={onChange} />
        ) : (
          <p className="hp-hint">
            <Icon name="leaf" size={14} />
            <span>
              {s.detail} Tap the garden to explore with {record.nickname}.
            </span>
          </p>
        )}
        {reduced && <p className="hp-fine hp-motion-note">Quiet motion is on</p>}
      </div>
    </div>
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
