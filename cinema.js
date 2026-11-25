/* Progressive shell enhancements; no framework or build step required. */
(() => {
  "use strict";
  const q = (s, root = document) => root.querySelector(s);
  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    discover:
      '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
    movies:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5m8-5v5"/>',
    series:
      '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4M9 23h6"/>',
    anime:
      '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    lab: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
    list: '<path d="M6 4h12v17l-6-4-6 4Z"/>',
    addons:
      '<path d="M4 4h5V3a3 3 0 0 1 6 0v1h5v5h1a3 3 0 0 1 0 6h-1v5h-5v-1a3 3 0 0 0-6 0v1H4v-5H3a3 3 0 0 1 0-6h1Z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6m-10 4 5 3-5 3Z"/>',
    settings:
      '<path d="m9 3-1 3-3 1v4l-2 1 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    back: '<path d="m14 5-7 7 7 7m-7-7h14"/>',
    mini: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="12" width="7" height="6" rx="1"/>',
    full: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    share: '<path d="M12 16V2m-5 5 5-5 5 5M5 12H3v9h18v-9h-2"/>',
    camera:
      '<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
    volume:
      '<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  };
  const icon = (name) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (icons[name] || icons.help) +
    "</svg>";
  const mark =
    '<svg class="brand-mark" viewBox="0 0 36 40" fill="none" aria-hidden="true"><path d="M4 9 18 1l15 9v20l-15 9L4 31Z" fill="currentColor" opacity=".18"/><path d="m5 9 13 8 14-7M18 17v21M5 9v20l13 9 14-9V10L18 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m13 12 13 8-13 8Z" fill="currentColor"/></svg>';
  const navItem = (page, label, extra = "") =>
    '<a class="side-link" data-page="' +
    page +
    '" href="#/' +
    page +
    '" data-route="#/' +
    page +
    '" title="' +
    label +
    '">' +
    icon(page === "home" ? "discover" : page) +
    "<span>" +
    label +
    "</span>" +
    extra +
    "</a>";
  q("#sidebar").innerHTML =
    '<a class="side-brand" href="#/home" data-route="#/home">' +
    mark +
    '<span>Stream<span>Eo</span></span></a><div class="side-label">BROWSE</div><nav class="side-nav" aria-label="Browse">' +
    navItem("home", "Discover") +
    navItem("movies", "Movies") +
    navItem("series", "TV series") +
    navItem("anime", "Anime") +
    navItem("list", "My library") +
    navItem("addons", "Add-ons") +
    navItem("lab", "Live TV", "<small>LIVE</small>") +
    '</nav><div class="side-label">YOUR SPACE</div><div class="side-nav secondary"><button class="side-link" id="openLocal">' +
    icon("file") +
    '<span>Local files</span></button><a class="side-link" href="#/direct" data-route="#/direct">' +
    icon("lab") +
    '<span>Open a stream</span></a></div><div class="side-bottom"><a class="side-link" href="#/addons" data-route="#/addons">' +
    icon("settings") +
    '<span>Manage add-ons</span></a><button class="side-link" id="shellHelp">' +
    icon("help") +
    '<span>Help & shortcuts</span></button><div class="side-status"><i></i> Your personal cinema <span>v3.0</span></div></div>';
  q("#searchForm button[type=submit]").innerHTML = icon("search");
  q("#searchForm").insertAdjacentHTML(
    "beforeend",
    '<span class="search-key" aria-hidden="true">Ctrl K</span>',
  );
  q(".top-right").insertAdjacentHTML(
    "beforeend",
    '<span class="top-divider"></span><button class="header-icon" id="topHelp" title="Help & keyboard shortcuts" aria-label="Help & keyboard shortcuts">' +
      icon("help") +
      '</button><a href="#/list" data-route="#/list" class="profile-button" aria-label="Open my library" title="My library">S</a>',
  );

  const dialog = document.createElement("dialog");
  dialog.className = "shortcuts-dialog";
  dialog.setAttribute("aria-labelledby", "shortcutsTitle");
  dialog.innerHTML =
    '<div class="dialog-title"><h2 id="shortcutsTitle">Make yourself at home.</h2><button aria-label="Close help">×</button></div><p>A few shortcuts for a better movie night. Playback shortcuts work in the built-in player, not inside external embeds.</p>' +
    [
      ["Search the catalog", "Ctrl / ⌘ K"],
      ["Play / pause", "Space / K"],
      ["Seek 10 seconds", "← / →"],
      ["Volume", "↑ / ↓"],
      ["Mute", "M"],
      ["Fullscreen", "F"],
      ["Mini player", "P"],
      ["Episodes", "E"],
      ["Close player / menu", "Esc"],
    ]
      .map(
        ([label, key]) =>
          '<div class="shortcut-row"><span>' +
          label +
          "</span><kbd>" +
          key +
          "</kbd></div>",
      )
      .join("") +
    '<p class="file-note">Bring your own movie: open a local MP4 or WebM file, or add a legal stream. Your local files stay on your device. Catalog listings do not guarantee a playable source.</p>';
  document.body.appendChild(dialog);
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  const showHelp = () => {
    if (!dialog.open) dialog.showModal();
  };
  q("#shellHelp").onclick = q("#topHelp").onclick = showHelp;

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "video/mp4,video/webm,video/ogg,.m4v,.mov";
  picker.hidden = true;
  document.body.appendChild(picker);
  let localUrl = null;
  const releaseLocal = () => {
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      localUrl = null;
    }
  };
  picker.onchange = () => {
    const file = picker.files[0];
    if (!file) return;
    closePlayer();
    releaseLocal();
    localUrl = URL.createObjectURL(file);
    openPlayer({
      title: file.name.replace(/\.[^.]+$/, ""),
      metaId: "local-file",
      videoId: "local-file",
      type: "movie",
      noHistory: true,
      localFile: true,
      sources: [
        {
          url: localUrl,
          label:
            "Local file · " + (file.name.split(".").pop() || "").toUpperCase(),
          noProxy: true,
        },
      ],
    });
    picker.value = "";
  };
  q("#openLocal").onclick = () => picker.click();
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cinema-local]")) picker.click();
  });

  const player = q("#player");
  const titleButtons = {
    playerClose: ["back", "Back to browsing"],
    playerMini: ["mini", "Mini player (P)"],
    playerFs: ["full", "Fullscreen (F)"],
    playerShot: ["camera", "Save screenshot"],
    playerVlc: ["lab", "Open in external player"],
    playerCopy: ["copy", "Copy stream link"],
    playerShare: ["share", "Share this moment"],
  };
  for (const [id, [name, label]] of Object.entries(titleButtons)) {
    const button = q("#" + id);
    button.innerHTML = icon(name);
    button.dataset.icon = icon(name);
    button.setAttribute("aria-label", label);
    button.dataset.label = label;
    button.title = label;
  }
  const tools = document.createElement("div");
  tools.className = "player-tools";
  tools.id = "playerTools";
  tools.innerHTML =
    '<button class="icon-btn" id="playerMore" aria-label="More player actions" aria-expanded="false" aria-controls="playerToolsPanel" title="More actions">' +
    icon("more") +
    '</button><div class="player-tools-panel" id="playerToolsPanel" hidden></div>';
  q(".player-top").appendChild(tools);
  const toolPanel = q("#playerToolsPanel");
  ["playerShot", "playerVlc", "playerCopy", "playerShare"].forEach((id) => {
    const b = q("#" + id);
    b.classList.add("tool-item");
    toolPanel.appendChild(b);
  });
  const more = q("#playerMore");
  const closeTools = () => {
    toolPanel.hidden = true;
    more.setAttribute("aria-expanded", "false");
  };
  more.onclick = () => {
    toolPanel.hidden = !toolPanel.hidden;
    more.setAttribute("aria-expanded", String(!toolPanel.hidden));
  };
  toolPanel.addEventListener("click", (e) => {
    if (e.target.closest("button")) closeTools();
  });
  document.addEventListener("click", (e) => {
    if (!tools.contains(e.target)) closeTools();
  });
  const helpButton = document.createElement("button");
  helpButton.className = "icon-btn";
  helpButton.id = "playerHelp";
  helpButton.title = "Keyboard shortcuts";
  helpButton.setAttribute("aria-label", "Keyboard shortcuts");
  helpButton.innerHTML = icon("help");
  helpButton.onclick = showHelp;
  q(".player-top").insertBefore(helpButton, tools);
  document.addEventListener(
    "keydown",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.open) dialog.close();
        if (!player.hidden && !player.classList.contains("mini-mode"))
          toggleMiniPlayer(true);
        q("#searchInput").focus();
        e.stopImmediatePropagation();
        return;
      }
      if (dialog.open) {
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Escape" && !toolPanel.hidden) {
        e.stopImmediatePropagation();
        closeTools();
        more.focus();
      }
    },
    true,
  );

  const context = {
    home: ["Discover", "Your next favorite is here."],
    movies: ["Movies", "Big stories. Bigger possibilities."],
    series: ["TV series", "Find your next obsession."],
    anime: ["Anime", "A world beyond the ordinary."],
    list: ["My library", "All your favorites, in one place."],
    addons: ["Add-ons", "Make this cinema yours."],
    lab: ["Live TV", "Tune into something good."],
    direct: ["Open a stream", "Your source. Your cinema."],
    search: ["Search", "Find something worth watching."],
  };
  function updateNavigation() {
    const page = (location.hash.split("/")[1] || "home").split("?")[0];
    document.querySelectorAll(".side-link[data-page]").forEach((a) => {
      const active = a.dataset.page === page;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const [title, sub] = context[page] || [
      "StreamEo",
      "A little escape, whenever you need it.",
    ];
    const el = q("#pageContext");
    el.replaceChildren(document.createTextNode(title));
    const span = document.createElement("span");
    span.textContent = sub;
    el.appendChild(span);
  }
  window.addEventListener("hashchange", updateNavigation);
  updateNavigation();

  let lastFocus = null;
  new MutationObserver(() => {
    if (!player.hidden) {
      if (!lastFocus) {
        lastFocus = document.activeElement;
        player.focus({ preventScroll: true });
      }
      player.setAttribute(
        "aria-modal",
        String(!player.classList.contains("mini-mode")),
      );
      player.classList.toggle("player-external", !!q("iframe", player));
    } else {
      closeTools();
      releaseLocal();
      if (lastFocus) {
        if (lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
        lastFocus = null;
      }
      if (player.classList.contains("player-external"))
        player.classList.remove("player-external");
    }
  }).observe(player, {
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });
  // Trap dialog focus, without hijacking Tab for seeking. Mini-player remains non-modal.
  document.addEventListener("keydown", (e) => {
    if (
      e.key !== "Tab" ||
      player.hidden ||
      player.classList.contains("mini-mode") ||
      dialog.open
    )
      return;
    const focusable = [
      ...player.querySelectorAll(
        'button, input, select, a[href], iframe, [tabindex="0"]',
      ),
    ].filter(
      (el) =>
        !el.disabled &&
        el.getClientRects().length &&
        getComputedStyle(el).visibility !== "hidden",
    );
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        !player.contains(document.activeElement))
    ) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  // Hide unsupported picture-in-picture instead of presenting an impossible action.
  const enhanceContent = () => {
    const pip = q("#npPip");
    if (pip && !document.pictureInPictureEnabled) pip.hidden = true;
    const mute = q("#npMute");
    if (mute) mute.setAttribute("aria-label", "Mute or unmute");
    document.querySelectorAll("#playerStage button[title]").forEach((b) => {
      if (!b.hasAttribute("aria-label")) b.setAttribute("aria-label", b.title);
    });
    const list = q("#heroListBtn");
    if (list) {
      const saved = list.textContent.includes("✓");
      list.setAttribute(
        "aria-label",
        saved ? "Remove from my library" : "Add to my library",
      );
      list.setAttribute("aria-pressed", String(saved));
    }
  };
  new MutationObserver(enhanceContent).observe(q("#app"), {
    childList: true,
    subtree: true,
  });
  new MutationObserver(enhanceContent).observe(q("#playerStage"), {
    childList: true,
  });
  enhanceContent();
})();
