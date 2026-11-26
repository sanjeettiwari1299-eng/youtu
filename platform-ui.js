/* User-facing settings, local profiles, observed health and safe support exports. */
(function () {
  "use strict";
  const q = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const prefix = (title, sub) =>
    '<div class="wrap platform-page"><div class="platform-title"><p class="eyebrow">YOUR PERSONAL CINEMA</p><h1>' +
    title +
    "</h1><p>" +
    sub +
    '</p></div><nav class="platform-tabs" aria-label="Your space"><a data-route="#/profiles" href="#/profiles">Profiles & sync</a><a data-route="#/settings" href="#/settings">Playback preferences</a><a data-route="#/health" href="#/health">Health centre</a></nav>';
  const row = (title, description, control) =>
    '<div class="preference-row"><div><h3>' +
    title +
    "</h3><p>" +
    description +
    "</p></div>" +
    control +
    "</div>";
  const checkbox = (key, label, defaultValue) =>
    '<input type="checkbox" aria-label="' +
    label +
    '" data-pref="' +
    key +
    '" ' +
    (store.get(key, defaultValue) ? "checked" : "") +
    ">";
  function download(name, data) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function settings() {
    q("#app").innerHTML =
      prefix(
        "Make movie night yours.",
        "Preferences are saved to the active local profile.",
      ) +
      '<section class="platform-panel"><h2>Playback</h2>' +
      row(
        "Resume where you left off",
        "Native-player progress is based on real video timestamps.",
        checkbox("se_auto_resume", "Automatically resume", true),
      ) +
      row(
        "Autoplay the next episode",
        "Only when a real next episode is supplied by your provider.",
        checkbox("se_autoplay_next", "Autoplay next episode", true),
      ) +
      row(
        "Next episode countdown",
        "You can always cancel before the next episode starts.",
        '<select aria-label="Next episode countdown" data-pref="se_next_delay">' +
          [5, 10, 15]
            .map(
              (n) =>
                '<option value="' +
                n +
                '" ' +
                (store.get("se_next_delay", 5) === n ? "selected" : "") +
                ">" +
                n +
                " seconds</option>",
            )
            .join("") +
          "</select>",
      ) +
      row(
        "Preferred subtitles",
        "Off by default. Manually uploaded subtitles still work.",
        '<select data-pref="se_sub_lang" aria-label="Preferred subtitles">' +
          [
            ["off", "Off"],
            ["en", "English"],
            ["hi", "Hindi"],
            ["ja", "Japanese"],
            ["es", "Spanish"],
            ["fr", "French"],
            ["de", "German"],
          ]
            .map(
              ([id, label]) =>
                '<option value="' +
                id +
                '" ' +
                (store.get("se_sub_lang", "off") === id ? "selected" : "") +
                ">" +
                label +
                "</option>",
            )
            .join("") +
          "</select>",
      ) +
      row(
        "Subtitle size",
        "Applied to the next video you open.",
        '<select data-pref="se_sub_size" aria-label="Subtitle size">' +
          ["18px", "21px", "26px", "32px"]
            .map(
              (size) =>
                "<option " +
                (store.get("se_sub_size", "21px") === size ? "selected" : "") +
                ">" +
                size +
                "</option>",
            )
            .join("") +
          "</select>",
      ) +
      '</section><section class="platform-panel"><h2>Navigation & privacy</h2>' +
      row(
        "TV / remote navigation",
        "Arrow keys move between visible controls outside the video player. Enter activates a focused control.",
        checkbox("se_tv_navigation", "TV remote navigation", false),
      ) +
      row(
        "Public proxy fallbacks",
        "OFF by default. Enabling sends stream URLs (possibly containing tokens) to third-party proxies. Prefer a worker you control.",
        checkbox("se_public_proxies", "Allow public proxies", false),
      ) +
      '<p class="platform-note">Profiles separate local data, not access to this browser. Anyone using this browser can switch profiles. External iframe players have their own controls and privacy policies.</p></section></div>';
    q("#app")
      .querySelectorAll("[data-pref]")
      .forEach(
        (input) =>
          (input.onchange = () => {
            const key = input.dataset.pref;
            if (
              key === "se_public_proxies" &&
              input.checked &&
              !confirm(
                "Third-party proxies can see complete stream URLs and tokens. Enable public proxies?",
              )
            ) {
              input.checked = false;
              return;
            }
            store.set(
              key,
              input.type === "checkbox"
                ? input.checked
                : key === "se_next_delay"
                  ? Number(input.value)
                  : input.value,
            );
            toast("Preference saved");
          }),
      );
  }
  function profiles() {
    const active = localProfiles.current();
    q("#app").innerHTML =
      prefix(
        "A space of your own.",
        "Local profiles keep separate libraries, progress and playback preferences. Cloud sync is optional.",
      ) +
      '<section class="platform-panel"><h2>On this device</h2><p class="platform-note">' +
      (localProfiles.available()
        ? "Local data is stored in this browser."
        : "Browser storage is unavailable. This session is temporary; export a backup before closing.") +
      ' Local profiles are not password-protected accounts.</p><div class="profile-grid">' +
      localProfiles
        .list()
        .map(
          (p) =>
            '<div class="profile-card ' +
            (p.id === active.id ? "current" : "") +
            '"><span class="profile-avatar">' +
            esc(p.name.slice(0, 1).toUpperCase()) +
            "</span><b>" +
            esc(p.name) +
            "</b><span>" +
            (p.id === active.id ? "Active profile" : "Local profile") +
            "</span>" +
            (p.id !== active.id
              ? '<button class="btn btn-sm btn-primary" data-switch-profile="' +
                esc(p.id) +
                '">Switch</button><button class="text-danger" data-delete-profile="' +
                esc(p.id) +
                '">Delete</button>'
              : "") +
            "</div>",
        )
        .join("") +
      '</div><form id="newProfile" class="platform-form"><label for="profileName">New profile name</label><input id="profileName" required maxlength="32" placeholder="e.g. Family"><button class="btn btn-primary">Create profile</button></form><form id="renameProfile" class="platform-form"><label for="renameName">Rename active profile</label><input id="renameName" maxlength="32" required value="' +
      esc(active.name) +
      '"><button class="btn btn-ghost">Rename</button></form></section><section class="platform-panel"><h2>Private cloud sync <span class="status-pill">' +
      (syncCode() ? "CONNECTED" : "LOCAL ONLY") +
      '</span></h2><p class="platform-note">No shared default profile, no public profile directory. Your 256-bit secret grants read/write access: keep it private. The server operator can read stored snapshots; this is not end-to-end encryption. A compatible deployed worker + D1 database is required.</p><form id="privateSyncForm" class="platform-form"><label for="privateSyncApi">Private sync worker URL</label><input id="privateSyncApi" type="url" placeholder="https://your-worker.workers.dev" required value="' +
      esc(syncBase()) +
      '"><label for="privateSyncToken">Private sync secret</label><input id="privateSyncToken" type="password" autocomplete="off" minlength="64" maxlength="64" pattern="[a-f0-9]{64}" required value="' +
      esc(syncCode()) +
      '"><div class="platform-actions"><button id="generateSecret" type="button" class="btn btn-ghost">Generate secret</button><button id="copySecret" type="button" class="btn btn-ghost">Copy secret</button><button class="btn btn-primary">Connect & download</button></div></form><p class="platform-note">' +
      esc(
        store.get(
          "se_sync_msg",
          "Cloud sync has never been enabled for this profile.",
        ),
      ) +
      '</p><div class="platform-actions"><button class="btn btn-ghost" id="uploadPrivate" ' +
      (!syncCode() ? "disabled" : "") +
      '>Upload snapshot</button><button class="btn btn-ghost" id="downloadPrivate" ' +
      (!syncCode() ? "disabled" : "") +
      '>Download latest</button><button class="btn btn-danger" id="disconnectPrivate" ' +
      (!syncCode() ? "disabled" : "") +
      '>Disconnect</button></div></section><section class="platform-panel"><h2>Library backup</h2><p class="platform-note">A backup contains personal library/progress and may contain configured add-on URLs. Keep it private. Sync secrets and playback observations are excluded. This is NOT the safe diagnostics report.</p><div class="platform-actions"><button id="exportProfile" class="btn btn-ghost">Export library backup</button><button id="importProfile" class="btn btn-ghost">Restore library backup</button><input id="profileBackupFile" type="file" accept="application/json,.json" hidden></div></section></div>';
    q("#app")
      .querySelectorAll("[data-switch-profile]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            switchLocalProfile(b.dataset.switchProfile);
            updateShell();
          }),
      );
    q("#app")
      .querySelectorAll("[data-delete-profile]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (
              confirm(
                "Delete this local profile and its local library? Cloud data is not deleted.",
              )
            ) {
              localProfiles.remove(b.dataset.deleteProfile);
              profiles();
            }
          }),
      );
    q("#newProfile").onsubmit = (e) => {
      e.preventDefault();
      try {
        localProfiles.create(q("#profileName").value);
        profiles();
      } catch (error) {
        toast(error.message, true);
      }
    };
    q("#renameProfile").onsubmit = (e) => {
      e.preventDefault();
      try {
        localProfiles.rename(q("#renameName").value);
        profiles();
        updateShell();
      } catch (error) {
        toast(error.message, true);
      }
    };
    q("#generateSecret").onclick = () => {
      try {
        q("#privateSyncToken").value = PlatformCore.secret();
        toast("Secret generated locally; copy it somewhere safe");
      } catch (_) {
        toast(
          "Secure randomness unavailable. Use a secure browser context.",
          true,
        );
      }
    };
    q("#copySecret").onclick = async () => {
      try {
        if (!PlatformCore.validSecret(q("#privateSyncToken").value))
          throw Error();
        await navigator.clipboard.writeText(q("#privateSyncToken").value);
        toast("Secret copied. Do not post it in issues or chat.");
      } catch (_) {
        toast("Clipboard unavailable or secret invalid", true);
      }
    };
    q("#privateSyncForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const api = new URL(q("#privateSyncApi").value);
        if (
          api.protocol !== "https:" ||
          api.username ||
          api.password ||
          api.search ||
          api.hash ||
          !["", "/"].includes(api.pathname)
        )
          throw Error(
            "Use an HTTPS worker origin without paths or query parameters",
          );
        const code = q("#privateSyncToken").value;
        if (!PlatformCore.validSecret(code))
          throw Error("Use a generated 64-character private secret");
        if (
          !confirm(
            "Download this cloud snapshot? If it exists, it replaces the active local library and preferences. Export a backup first if needed.",
          )
        )
          return;
        syncEpoch++;
        syncUpload = null;
        syncControllers.forEach((c) => c.abort());
        clearTimeout(syncTimer);
        store.set("se_sync_api", api.origin);
        store.set("se_sync_code", code);
        store.set("se_sync_revision", 0);
        S.d1Pulled = false;
        S.syncConflict = false;
        await pullSync(true);
        if ((location.hash || "").includes("profiles")) profiles();
      } catch (error) {
        toast(error.message, true);
      }
    };
    q("#uploadPrivate").onclick = async () => {
      await pushSync(true);
      if ((location.hash || "").includes("profiles")) profiles();
    };
    q("#downloadPrivate").onclick = async () => {
      if (
        confirm(
          "Download and apply this private cloud snapshot to the active local profile?",
        )
      ) {
        await pullSync(true);
        if ((location.hash || "").includes("profiles")) profiles();
      }
    };
    q("#disconnectPrivate").onclick = () => {
      syncEpoch++;
      syncUpload = null;
      syncControllers.forEach((c) => c.abort());
      clearTimeout(syncTimer);
      store.del("se_sync_code");
      store.del("se_sync_revision");
      store.del("se_sync_ts");
      store.set("se_sync_msg", "Disconnected. Local data was kept.");
      S.syncConflict = false;
      profiles();
    };
    q("#exportProfile").onclick = () =>
      download("streameo-private-library.json", {
        schema: 1,
        data: JSON.parse(syncSnapshot()),
      });
    q("#importProfile").onclick = () => q("#profileBackupFile").click();
    q("#profileBackupFile").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 262144) {
        toast("Backup must be smaller than 256 KiB", true);
        return;
      }
      const id = localProfiles.current().id;
      try {
        const parsed = JSON.parse(await file.text());
        if (id !== localProfiles.current().id) return;
        const data = parsed.data || parsed;
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw Error();
        if (
          !confirm(
            "Restore this private backup? It can change your library and installed providers.",
          )
        )
          return;
        applyRemote(data);
        updateNavListBadge();
        hydrateFromCache();
        toast("Backup restored locally");
        profiles();
      } catch (_) {
        toast("Invalid backup", true);
      }
    };
  }
  function health() {
    const observed = playbackMonitor.providers();
    q("#app").innerHTML =
      prefix(
        "Know what’s working.",
        "Observed results only—an installed manifest is not proof that a stream will play.",
      ) +
      '<section class="platform-panel"><h2>Live request queue</h2><output id="healthQueue"></output><p class="platform-note">Network/CORS cannot always be distinguished by a browser. A provider with no observations has not been tested in this session.</p></section><section class="platform-panel"><h2>Installed provider health</h2><div id="providerHealth">' +
      S.addons
        .map((addon, i) => {
          const origin = PlatformCore.originOf(addon.base),
            status = observed.find((p) => p.origin === origin);
          return (
            '<div class="health-row"><div><b>' +
            esc(addon.manifest.name) +
            "</b><small>" +
            esc(origin) +
            '</small></div><span class="status-pill">' +
            esc(status?.status || "unobserved") +
            "</span><small>" +
            (status?.latencyMs
              ? status.latencyMs + " ms response"
              : "No response timing") +
            '</small><button class="btn btn-sm btn-ghost" data-health-retry="' +
            i +
            '">Retry manifest</button></div>'
          );
        })
        .join("") +
      '</div></section><section class="platform-panel"><h2>Privacy-safe support report</h2><p class="platform-note">Contains version, queue/cache counts, anonymous provider counters and aggregate playback observations. No URLs, hostnames, titles, history, add-on names, tokens, profile identifiers or raw errors. This report is generated only when you click.</p><div class="platform-actions"><button id="downloadDiagnostics" class="btn btn-primary">Download safe diagnostics</button><button id="clearObservations" class="btn btn-ghost">Reset playback observations</button><a class="btn btn-ghost" href="#/addons" data-route="#/addons">Manage add-ons</a></div></section></div>';
    q("#downloadDiagnostics").onclick = () =>
      download(
        "streameo-diagnostics.json",
        PlatformCore.diagnostics({
          build: APP_BUILD,
          queue: addonClient.snapshot(),
          providers: playbackMonitor.providers(),
          playback: playbackMonitor.summary(),
          storage: localProfiles.available(),
        }),
      );
    q("#clearObservations").onclick = () => {
      playbackMonitor.clear();
      health();
    };
    q("#app")
      .querySelectorAll("[data-health-retry]")
      .forEach((button) => {
        const base = S.addons[Number(button.dataset.healthRetry)]?.base;
        button.onclick = async () => {
          button.disabled = true;
          await retryAddon(base);
          if (location.hash === "#/health") health();
        };
      });
    refreshHealth();
  }
  function refreshHealth() {
    const output = q("#healthQueue");
    if (!output || document.hidden) return;
    const stats = addonClient.snapshot();
    output.textContent = `${stats.active} active · ${stats.queued} queued · ${stats.hits} cache hits · ${stats.shared} duplicate requests avoided`;
  }
  function updateShell() {
    const profile = q(".profile-button");
    if (profile) {
      profile.href = "#/profiles";
      profile.dataset.route = "#/profiles";
      profile.textContent = localProfiles
        .current()
        .name.slice(0, 1)
        .toUpperCase();
      profile.setAttribute("aria-label", "Profiles and private sync");
      profile.title = "Profiles and private sync";
    }
  }
  window.PlatformUI = {
    render(page) {
      if (page === "settings") settings();
      else if (page === "health") health();
      else profiles();
      updateShell();
    },
  };
  const bottom = q(".side-bottom");
  if (bottom)
    bottom.insertAdjacentHTML(
      "afterbegin",
      '<a class="side-link" href="#/settings" data-route="#/settings"><span aria-hidden="true">⚙</span><span>Preferences</span></a><a class="side-link" href="#/health" data-route="#/health"><span aria-hidden="true">◉</span><span>Health centre</span></a>',
    );
  updateShell();
  const initial = (location.hash.split("/")[1] || "").split("?")[0];
  if (["profiles", "settings", "health", "sync"].includes(initial))
    PlatformUI.render(initial);
  setInterval(refreshHealth, 1000);
  document.addEventListener("keydown", (event) => {
    if (
      !store.get("se_tv_navigation", false) ||
      !q("#player").hidden ||
      document.querySelector("dialog[open]") ||
      !/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown)$/.test(event.key) ||
      /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")
    )
      return;
    const current = document.activeElement;
    const rect = current?.getBoundingClientRect();
    if (!rect || current === document.body) return;
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2,
      horizontal = /Left|Right/.test(event.key),
      positive = /Right|Down/.test(event.key);
    const candidates = [
      ...document.querySelectorAll(
        "#app a[href],#app button,#app select,#sidebar a[href],#sidebar button",
      ),
    ]
      .filter(
        (el) => el !== current && !el.disabled && el.getClientRects().length,
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        const dx = r.x + r.width / 2 - x,
          dy = r.y + r.height / 2 - y;
        const along = horizontal ? dx : dy,
          cross = horizontal ? dy : dx;
        return { el, along, cost: Math.abs(along) + Math.abs(cross) * 2 };
      })
      .filter((item) => (positive ? item.along > 5 : item.along < -5))
      .sort((a, b) => a.cost - b.cost);
    if (candidates[0]) {
      event.preventDefault();
      candidates[0].el.focus();
      candidates[0].el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto",
      });
    }
  });
})();
