/* Bounded, priority-aware add-on transport. No stream/video bytes are persisted. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AddonEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const minute = 60000;
  function policyFor(url) {
    const path = new URL(url, "https://local.invalid").pathname;
    if (path.includes("/stream/"))
      return {
        priority: 0,
        ttl: 20000,
        stale: 0,
        timeout: 4000,
        persist: false,
      };
    if (path.includes("/meta/"))
      return {
        priority: 1,
        ttl: 15 * minute,
        stale: 24 * 60 * minute,
        timeout: 3500,
        persist: true,
      };
    if (path.endsWith("/manifest.json"))
      return {
        priority: 2,
        ttl: 15 * minute,
        stale: 7 * 24 * 60 * minute,
        timeout: 4500,
        persist: true,
      };
    if (path.includes("/catalog/"))
      return {
        priority: path.includes("/search=") ? 1 : 3,
        ttl: 2 * minute,
        stale: 60 * minute,
        timeout: 4500,
        persist: !path.includes("/search="),
      };
    if (path.includes("/subtitles/"))
      return {
        priority: 1,
        ttl: 5 * minute,
        stale: 0,
        timeout: 4000,
        persist: false,
      };
    return {
      priority: 2,
      ttl: 2 * minute,
      stale: 0,
      timeout: 6000,
      persist: false,
    };
  }

  // Optional IndexedDB cache. Blocked/private-mode storage must never block requests.
  function diskCache() {
    let db = null,
      epoch = 0,
      clearRequested = false;
    const ready = new Promise((resolve) => {
      let request;
      const timer = setTimeout(() => resolve([]), 1500);
      try {
        if (typeof indexedDB === "undefined") {
          clearTimeout(timer);
          return resolve([]);
        }
        request = indexedDB.open("streameo-addon-cache", 2);
        request.onupgradeneeded = () => {
          const store = request.result.objectStoreNames.contains("json")
            ? request.transaction.objectStore("json")
            : request.result.createObjectStore("json", { keyPath: "url" });
          if (!store.indexNames.contains("at")) store.createIndex("at", "at");
        };
        request.onerror = request.onblocked = () => {
          clearTimeout(timer);
          resolve([]);
        };
        request.onsuccess = () => {
          db = request.result;
          db.onversionchange = () => {
            db.close();
            db = null;
          };
          const version = epoch;
          if (clearRequested) {
            try {
              db.transaction("json", "readwrite").objectStore("json").clear();
            } catch (_) {}
            clearTimeout(timer);
            resolve([]);
            return;
          }
          try {
            // A single bulk read avoids up to 160 asynchronous cursor round trips.
            // Writers enforce the 160-record cap; keep only newest entries defensively.
            const read = db.transaction("json").objectStore("json").getAll();
            read.onsuccess = () => {
              clearTimeout(timer);
              const records = read.result
                .sort((a, b) => b.at - a.at)
                .slice(0, 160);
              resolve(version === epoch ? records : []);
            };
            read.onerror = () => {
              clearTimeout(timer);
              resolve([]);
            };
          } catch (_) {
            clearTimeout(timer);
            resolve([]);
          }
        };
      } catch (_) {
        clearTimeout(timer);
        resolve([]);
      }
    });
    return {
      ready,
      put(record, evicted) {
        if (!db) return;
        try {
          const tx = db.transaction("json", "readwrite");
          tx.onerror = () => {};
          const store = tx.objectStore("json");
          store.put(record);
          if (evicted) store.delete(evicted);
          const count = store.count();
          count.onsuccess = () => {
            let excess = count.result - 160;
            if (excess <= 0) return;
            const cursor = store.index("at").openCursor();
            cursor.onsuccess = () => {
              if (cursor.result && excess-- > 0) {
                cursor.result.delete();
                cursor.result.continue();
              }
            };
          };
        } catch (_) {}
      },
      clear() {
        epoch++;
        clearRequested = true;
        if (!db) return;
        try {
          const tx = db.transaction("json", "readwrite");
          tx.onerror = () => {};
          tx.objectStore("json").clear();
        } catch (_) {}
      },
    };
  }

  function createClient(options = {}) {
    const fetcher = options.fetch || ((...args) => fetch(...args));
    const now = options.now || Date.now;
    const limit = options.concurrency || 8;
    const hostLimit = options.perHost || 3;
    const memory = new Map(),
      pending = new Map(),
      hosts = new Map(),
      latency = new Map(),
      queue = [];
    const disk = options.persistence === false ? null : diskCache();
    const stats = { network: 0, hits: 0, stale: 0, shared: 0, failures: 0 };
    let active = 0,
      ordinary = 0,
      generation = 0,
      hydrated = !disk;
    const hydrationGeneration = generation;
    const ready = disk
      ? disk.ready
          .then((records) => {
            if (hydrationGeneration !== generation) return;
            for (const record of records
              .sort((a, b) => a.at - b.at)
              .slice(-160)) {
              if (record.until > now() && !memory.has(record.url))
                memory.set(record.url, record);
            }
          })
          .finally(() => {
            hydrated = true;
          })
      : Promise.resolve();
    const hostOf = (url) => new URL(url, "https://local.invalid").host;
    function pump() {
      queue.sort((a, b) => a.priority - b.priority);
      for (let i = 0; i < queue.length && active < limit; ) {
        const task = queue[i],
          count = hosts.get(task.host) || 0;
        // Reserve two global slots and one per-host slot for playback/metadata.
        const urgent = task.priority <= 1;
        const playback = task.priority === 0;
        if (
          count >= (playback ? hostLimit : Math.max(1, hostLimit - 1)) ||
          (!urgent && ordinary >= Math.max(1, limit - 2)) ||
          (!playback && active >= Math.max(1, limit - 1))
        ) {
          i++;
          continue;
        }
        queue.splice(i, 1);
        active++;
        if (!urgent) ordinary++;
        hosts.set(task.host, count + 1);
        task.start(() => {
          active--;
          if (!urgent) ordinary--;
          hosts.set(task.host, Math.max(0, (hosts.get(task.host) || 1) - 1));
          pump();
        });
      }
    }
    function schedule(url, priority, timeout, run) {
      return new Promise((resolve, reject) => {
        let finished = false,
          release = null,
          timer;
        const controller = new AbortController();
        const finish = (error, value) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          const index = queue.indexOf(task);
          if (index >= 0) queue.splice(index, 1);
          if (release) release();
          error ? reject(error) : resolve(value);
        };
        const task = {
          priority,
          host: hostOf(url),
          start(releaseSlot) {
            release = releaseSlot;
            clearTimeout(timer);
            timer = setTimeout(() => {
              controller.abort();
              finish(new Error("Addon request timed out"));
            }, timeout);
            Promise.resolve()
              .then(() => run(controller.signal))
              .then(
                (value) => finish(null, value),
                (error) => finish(error),
              );
          },
        };
        timer = setTimeout(
          () => finish(new Error("Addon queue timed out")),
          options.queueTimeout || 15000,
        );
        queue.push(task);
        pump();
      });
    }
    function save(url, data, policy, ticket) {
      if (ticket !== generation) return;
      const record = {
        url,
        data,
        at: now(),
        until: now() + policy.ttl + policy.stale,
      };
      memory.delete(url);
      memory.set(url, record);
      let evicted;
      if (memory.size > 160) {
        evicted = memory.keys().next().value;
        memory.delete(evicted);
      }
      // Do not store signed/configured add-on URLs on disk. Queries can contain tokens.
      const parsed = new URL(url, "https://local.invalid");
      const publicPath = /^\/(manifest\.json$|catalog\/|meta\/)/.test(
        parsed.pathname,
      );
      if (
        disk &&
        policy.persist &&
        publicPath &&
        !parsed.search &&
        !parsed.username &&
        !parsed.password &&
        JSON.stringify(record).length < 750000
      )
        disk.put(record, evicted);
    }
    function network(url, settings, policy) {
      if (pending.has(url)) {
        stats.shared++;
        return pending.get(url);
      }
      const ticket = generation;
      const work = schedule(
        url,
        settings.priority ?? policy.priority,
        settings.timeoutMs || policy.timeout,
        async (signal) => {
          if (
            options.isHostOpen &&
            options.isHostOpen(url) &&
            !settings.noCache
          )
            throw new Error("HOSTOPEN " + hostOf(url));
          const start = now();
          stats.network++;
          // No automatic retry storm. Explicit Retry is a fresh user-driven attempt.
          const response = await fetcher(url, {
            signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const text = await response.text(); // Deadline also covers the response body.
          if (text.trim().startsWith("<")) throw new Error("HTTPBLOCK");
          let data;
          try {
            data = JSON.parse(text);
          } catch (_) {
            throw new Error("BADJSON");
          }
          if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            data.error
          )
            throw new Error("BADJSON");
          if (signal.aborted) throw new Error("Addon request timed out");
          const elapsed = Math.max(1, now() - start),
            host = hostOf(url);
          latency.set(
            host,
            latency.has(host)
              ? latency.get(host) * 0.7 + elapsed * 0.3
              : elapsed,
          );
          if (ticket === generation && options.onSuccess)
            options.onSuccess(url, elapsed);
          save(url, data, policy, ticket);
          return data;
        },
      )
        .catch((error) => {
          stats.failures++;
          if (
            ticket === generation &&
            options.onFailure &&
            !String(error.message).startsWith("HOSTOPEN") &&
            !/queue timed out/.test(error.message)
          )
            options.onFailure(url, error);
          throw error;
        })
        .finally(() => {
          if (pending.get(url) === work) pending.delete(url);
        });
      pending.set(url, work);
      return work;
    }
    function request(url, settings = {}) {
      const policy = { ...policyFor(url), ...(settings.policy || {}) };
      if (
        disk &&
        !hydrated &&
        !settings.noCache &&
        policy.persist &&
        !settings.skipHydrate
      ) {
        return new Promise((resolve) => {
          const timer = setTimeout(resolve, 120);
          ready.then(() => {
            clearTimeout(timer);
            resolve();
          });
        }).then(() => request(url, { ...settings, skipHydrate: true }));
      }
      const record = memory.get(url);
      if (!settings.noCache && record) {
        const age = now() - record.at;
        if (age < policy.ttl) {
          stats.hits++;
          return Promise.resolve(record.data);
        }
        if (age < policy.ttl + policy.stale) {
          stats.hits++;
          stats.stale++;
          network(url, settings, policy).catch(() => {});
          return Promise.resolve(record.data);
        }
        memory.delete(url);
      }
      return network(url, settings, policy);
    }
    return {
      request,
      ready,
      peek(url) {
        const record = memory.get(url);
        return record && record.until > now() ? record.data : null;
      },
      rank(items, urlOf = (item) => item.base) {
        return items
          .slice()
          .sort(
            (a, b) =>
              (latency.get(hostOf(urlOf(a))) || 500) -
              (latency.get(hostOf(urlOf(b))) || 500),
          );
      },
      snapshot: () => ({
        ...stats,
        active,
        queued: queue.length,
        cached: memory.size,
      }),
      clear() {
        generation++;
        memory.clear();
        if (disk) disk.clear();
      },
    };
  }
  // Resolve early for playback, but keep publishing slower providers as they finish.
  function collect(tasks, options = {}) {
    const output = [];
    return new Promise((resolve) => {
      let done = false,
        timer = null;
      const finish = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(output.slice());
        }
      };
      if (options.firstUseful)
        timer = setTimeout(finish, options.waitMs ?? 1800);
      Promise.all(
        tasks.map((task) =>
          Promise.resolve()
            .then(task)
            .then((value) => {
              if (value) {
                output.push(value);
                if (options.onUpdate) {
                  try {
                    options.onUpdate(output.slice());
                  } catch (_) {}
                }
                if (options.firstUseful && options.firstUseful(value)) finish();
              }
            })
            .catch(() => {}),
        ),
      ).then(finish);
    });
  }
  return { createClient, collect, policyFor };
});
