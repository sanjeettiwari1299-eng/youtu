/* Local profile isolation, playback observations, and allowlisted diagnostics. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlatformCore = api;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";
  const PROFILE_KEY = "streameo_profiles_v1";
  const forbidden = new Set(["streameo_d1_main", "__probe__"]);
  function secret(cryptoImpl = globalThis.crypto) {
    if (!cryptoImpl || !cryptoImpl.getRandomValues)
      throw Error("Secure randomness unavailable");
    return Array.from(cryptoImpl.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  function validSecret(value) {
    return (
      typeof value === "string" &&
      /^[a-f0-9]{64}$/.test(value) &&
      !forbidden.has(value)
    );
  }
  function safeStorage() {
    try {
      return globalThis.localStorage || null;
    } catch (_) {
      return null;
    }
  }
  function cleanData(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [k, v] of Object.entries(value)) {
      if (/^se_[a-z0-9_]{1,50}$/.test(k)) out[k] = v;
    }
    return out;
  }
  function safeLibraryItem(item) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 200
    )
      return null;
    const out = {
      id: item.id,
      type: ["movie", "series", "anime", "free"].includes(item.type)
        ? item.type
        : "movie",
    };
    for (const key of ["name", "releaseInfo", "year", "imdbRating"])
      if (typeof item[key] === "string" || typeof item[key] === "number")
        out[key] = String(item[key]).slice(0, 300);
    for (const key of ["poster", "backdrop"])
      if (typeof item[key] === "string" && item[key].length <= 2000) {
        try {
          const url = new URL(item[key]);
          if (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password
          )
            out[key] = url.href;
        } catch (_) {
          if (
            /^\/?(?:assets\/)[\w./-]+$/.test(item[key]) &&
            !item[key].includes("..")
          )
            out[key] = item[key];
        }
      }
    if (
      typeof item.link === "string" &&
      /^#\/detail\/[a-z]+\/[a-zA-Z0-9:%_.-]+$/.test(item.link)
    )
      out.link = item.link;
    if (typeof item.free === "boolean") out.free = item.free;
    if (Array.isArray(item.genres))
      out.genres = item.genres
        .filter((g) => typeof g === "string")
        .slice(0, 5)
        .map((g) => g.slice(0, 100));
    if (Number.isFinite(item.at)) out.at = Math.max(0, item.at);
    return out;
  }
  function validateSnapshot(value) {
    const data = cleanData(value),
      out = {};
    for (const [key, v] of Object.entries(data)) {
      if (["se_list", "se_history"].includes(key) && Array.isArray(v))
        out[key] = v.slice(0, 500).map(safeLibraryItem).filter(Boolean);
      else if (key === "se_addons" && Array.isArray(v))
        out[key] = v.slice(0, 100).filter((url) => {
          try {
            const parsed = new URL(url);
            return (
              parsed.protocol === "https:" &&
              !parsed.username &&
              !parsed.password
            );
          } catch (_) {
            return false;
          }
        });
      else if (
        key === "se_progress" &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      ) {
        out[key] = {};
        for (const [id, p] of Object.entries(v).slice(0, 500))
          if (
            id !== "__proto__" &&
            p &&
            typeof p === "object" &&
            Number.isFinite(p.t) &&
            Number.isFinite(p.d) &&
            p.t >= 0 &&
            p.d >= 0
          )
            out[key][id] = { ...safeLibraryItem({ ...p, id }), t: p.t, d: p.d };
      } else if (
        [
          "se_adshield",
          "se_autoplay_next",
          "se_auto_resume",
          "se_tv_navigation",
        ].includes(key) &&
        typeof v === "boolean"
      )
        out[key] = v;
      else if (
        key === "se_builtin" &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      )
        out[key] = Object.fromEntries(
          Object.entries(v).filter(
            ([k, val]) =>
              ["free", "freetv", "classics"].includes(k) &&
              typeof val === "boolean",
          ),
        );
      else if (key === "se_next_delay" && [5, 10, 15].includes(v)) out[key] = v;
      else if (
        key === "se_theme" &&
        ["stremio", "netflix", "default", "hacker", "oled"].includes(v)
      )
        out[key] = v;
      else if (
        key === "se_sub_lang" &&
        typeof v === "string" &&
        /^(off|[a-z]{2,3})$/.test(v)
      )
        out[key] = v;
      else if (
        key === "se_sub_size" &&
        ["18px", "21px", "26px", "32px"].includes(v)
      )
        out[key] = v;
      else if (
        key === "se_sub_offsets" &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      )
        out[key] = Object.fromEntries(
          Object.entries(v)
            .slice(-100)
            .filter(
              ([id, offset]) =>
                id !== "__proto__" &&
                Number.isFinite(offset) &&
                Math.abs(offset) <= 30,
            ),
        );
      else if (
        key === "se_audio_pref" &&
        typeof v === "string" &&
        v.length <= 50
      )
        out[key] = v;
    }
    return out;
  }
  function createProfiles({
    storage = safeStorage(),
    id = () => secret().slice(0, 24),
  } = {}) {
    let state,
      available = !!storage;
    try {
      state = JSON.parse(storage?.getItem(PROFILE_KEY) || "null");
    } catch (_) {
      available = false;
    }
    if (
      !state ||
      state.version !== 1 ||
      !Array.isArray(state.profiles) ||
      !state.profiles.length
    )
      state = { version: 1, active: "", profiles: [] };
    state.profiles = state.profiles
      .slice(0, 8)
      .filter(
        (p) => p && typeof p.id === "string" && typeof p.name === "string",
      )
      .map((p) => ({
        ...p,
        name: p.name.slice(0, 32),
        data: cleanData(p.data),
      }));
    if (!state.profiles.length) {
      const first = { id: id(), name: "Personal", data: {} };
      state.profiles = [first];
      state.active = first.id;
    }
    if (!state.profiles.some((p) => p.id === state.active))
      state.active = state.profiles[0].id;
    function persist() {
      try {
        if (!storage) return;
        storage.setItem(PROFILE_KEY, JSON.stringify(state));
        available = true;
      } catch (_) {
        available = false;
      }
    }
    const current = () => state.profiles.find((p) => p.id === state.active);
    persist();
    return {
      current: () => JSON.parse(JSON.stringify(current())),
      list: () => state.profiles.map(({ id, name }) => ({ id, name })),
      available: () => available,
      set(k, v) {
        if (!/^se_[a-z0-9_]{1,50}$/.test(k)) return;
        current().data[k] = v;
        persist();
      },
      delete(k) {
        delete current().data[k];
        persist();
      },
      clear() {
        current().data = {};
        persist();
      },
      create(name) {
        name = String(name || "")
          .trim()
          .slice(0, 32);
        if (!name) throw Error("Enter a profile name");
        if (state.profiles.length >= 8)
          throw Error("Maximum eight local profiles");
        const profile = { id: id(), name, data: {} };
        state.profiles.push(profile);
        persist();
        return profile.id;
      },
      switch(id) {
        if (!state.profiles.some((p) => p.id === id))
          throw Error("Profile not found");
        state.active = id;
        persist();
        return this.current();
      },
      rename(name) {
        name = String(name || "")
          .trim()
          .slice(0, 32);
        if (!name) throw Error("Enter a profile name");
        current().name = name;
        persist();
      },
      remove(id) {
        if (state.profiles.length === 1)
          throw Error("Keep at least one profile");
        if (id === state.active)
          throw Error("Switch profiles before deleting the active one");
        state.profiles = state.profiles.filter((p) => p.id !== id);
        persist();
      },
    };
  }
  function originOf(url) {
    try {
      const parsed = new URL(url);
      return /^https?:$/.test(parsed.protocol) ? parsed.origin : null;
    } catch (_) {
      return null;
    }
  }
  function errorKind(error) {
    const text = String(error?.message || error || "");
    if (/timed out|abort/i.test(text)) return "timeout";
    if (/HTTP 4\d\d/.test(text)) return "http-client";
    if (/HTTP 5\d\d/.test(text)) return "http-server";
    if (/BADJSON|HTTPBLOCK/.test(text)) return "invalid-response";
    if (/HOSTOPEN/.test(text)) return "cooldown";
    return "network-or-cors";
  }
  function createMonitor({
    now = Date.now,
    read = () => null,
    write = () => {},
  } = {}) {
    let metrics = {};
    try {
      const saved = read();
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        for (const [origin, record] of Object.entries(saved).slice(0, 80)) {
          if (
            originOf(origin) !== origin ||
            !record ||
            typeof record !== "object"
          )
            continue;
          metrics[origin] = Object.fromEntries(
            [
              "samples",
              "failures",
              "startupMs",
              "bufferMs",
              "cooldownUntil",
              "updated",
            ].map((key) => [
              key,
              Number.isFinite(record[key]) ? Math.max(0, record[key]) : 0,
            ]),
          );
        }
    } catch (_) {}
    const providers = new Map();
    function entry(url) {
      const origin = originOf(url);
      if (!origin) return null;
      return (
        metrics[origin] ||
        (metrics[origin] = {
          samples: 0,
          failures: 0,
          startupMs: 0,
          bufferMs: 0,
          cooldownUntil: 0,
          updated: now(),
        })
      );
    }
    function save() {
      const sorted = Object.entries(metrics)
        .sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0))
        .slice(0, 80);
      metrics = Object.fromEntries(sorted);
      try {
        write(metrics);
      } catch (_) {}
    }
    return {
      provider(url, elapsed, error) {
        const origin = originOf(url);
        if (!origin) return;
        const old = providers.get(origin) || {
          origin,
          requests: 0,
          failures: 0,
          latencyMs: 0,
          status: "unobserved",
        };
        old.requests++;
        old.updated = now();
        if (error) {
          old.failures++;
          old.status = errorKind(error);
        } else {
          old.latencyMs = Math.round(
            old.latencyMs ? old.latencyMs * 0.7 + elapsed * 0.3 : elapsed,
          );
          old.status = "responding";
        }
        providers.set(origin, old);
      },
      begin(url) {
        return { url, at: now(), first: false, failed: false, waiting: null };
      },
      playing(ticket) {
        if (!ticket || ticket.failed) return;
        const record = entry(ticket.url);
        if (!record) return;
        if (!ticket.first) {
          const elapsed = Math.max(0, Math.min(120000, now() - ticket.at));
          record.startupMs = record.samples
            ? record.startupMs * 0.7 + elapsed * 0.3
            : elapsed;
          record.samples++;
          record.cooldownUntil = 0;
          ticket.first = true;
        }
        if (ticket.waiting !== null) {
          record.bufferMs += Math.max(
            0,
            Math.min(120000, now() - ticket.waiting),
          );
          ticket.waiting = null;
        }
        record.updated = now();
        save();
      },
      waiting(ticket) {
        if (ticket?.first && !ticket.failed && ticket.waiting === null)
          ticket.waiting = now();
      },
      pause(ticket) {
        if (ticket) ticket.waiting = null;
      },
      failure(ticket) {
        if (!ticket || ticket.failed) return;
        ticket.failed = true;
        ticket.waiting = null;
        const record = entry(ticket.url);
        if (!record) return;
        record.failures++;
        record.updated = now();
        if (record.failures >= 3 && record.failures > record.samples)
          record.cooldownUntil = now() + 5 * 60000;
        save();
      },
      rank(sources) {
        return sources
          .map((source, i) => {
            const record = metrics[originOf(source.url)];
            const score = record
              ? (record.cooldownUntil > now() ? 100 : 0) +
                (record.failures /
                  Math.max(1, record.samples + record.failures)) *
                  10 +
                (record.samples ? record.startupMs / 2000 : 3) +
                Math.min(
                  10,
                  record.bufferMs / Math.max(1, record.samples) / 3000,
                )
              : 4;
            return { source, i, score };
          })
          .sort((a, b) => a.score - b.score || a.i - b.i)
          .map((x) => x.source);
      },
      providers: () => Array.from(providers.values(), (v) => ({ ...v })),
      summary() {
        return {
          observedOrigins: Object.keys(metrics).length,
          successfulStarts: Object.values(metrics).reduce(
            (n, v) => n + (Number(v.samples) || 0),
            0,
          ),
          failedAttempts: Object.values(metrics).reduce(
            (n, v) => n + (Number(v.failures) || 0),
            0,
          ),
        };
      },
      clear() {
        metrics = {};
        providers.clear();
        save();
      },
    };
  }
  // Explicit allowlist, not regex-based scrubbing of arbitrary URLs/errors/history.
  function diagnostics({
    build,
    queue = {},
    providers = [],
    playback = {},
    storage = false,
  } = {}) {
    const number = (n) =>
      Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : 0;
    const counts = {};
    for (const key of [
      "network",
      "hits",
      "stale",
      "shared",
      "failures",
      "active",
      "queued",
      "cached",
    ])
      counts[key] = number(queue[key]);
    const safeProviders = providers
      .slice(0, 80)
      .map((p, i) => ({
        provider: "Provider " + (i + 1),
        requests: number(p.requests),
        failures: number(p.failures),
        latencyMs: number(p.latencyMs),
        status: [
          "responding",
          "unobserved",
          "timeout",
          "http-client",
          "http-server",
          "invalid-response",
          "cooldown",
          "network-or-cors",
        ].includes(p.status)
          ? p.status
          : "unobserved",
      }));
    return {
      schema: 1,
      build: /^v[\w.-]{1,40}$/.test(build || "") ? build : "unknown",
      persistentLocalStorage: !!storage,
      requests: counts,
      providers: safeProviders,
      playback: {
        observedOrigins: number(playback.observedOrigins),
        successfulStarts: number(playback.successfulStarts),
        failedAttempts: number(playback.failedAttempts),
      },
    };
  }
  return {
    secret,
    validSecret,
    validateSnapshot,
    safeStorage,
    cleanData,
    createProfiles,
    createMonitor,
    errorKind,
    originOf,
    diagnostics,
  };
});
