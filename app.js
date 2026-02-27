/* ============================================================
   APP LOGIC — Baby Checklist v2.0
   ============================================================
   Handles: Google Sign-In, Sheets sync, multi-user,
   section tabs, hero stats, filter pills, category card grid,
   drill-down drawer, checkbox persistence.

   Storage strategy:
   - localStorage = fast local cache (always available)
   - Google Sheets = source of truth (when signed in)
   - On sign-in: Sheet data overwrites localStorage (shared across all users)
   - On checkbox: localStorage updates instantly, Sheet syncs async
   - Multi-user: one row per item, last action wins, checked_by tracks who
   ============================================================ */

// ── Google Config ─────────────────────────────────────────────

var GOOGLE_CONFIG = {
  clientId:
    "531203228430-94fbaf0bc30tkp211gvac6ihbk4cc1do.apps.googleusercontent.com",
  discoveryDocs: [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
  ],
  scopes:
    "https://www.googleapis.com/auth/spreadsheets email profile",
  spreadsheetId: "1w7HcJwvlM-1meMxRAJdfQ3idzDJwHRRD5r9lI1BNWpw",
  sheetName: "Checklist",
};

// ── Category Icons ────────────────────────────────────────────

var CATEGORY_ICONS = {
  Feeding: "🍼",
  Diapering: "🧷",
  Clothing: "👕",
  Sleep: "🌙",
  "Bathing & Grooming": "🛁",
  "Health & Safety": "🩺",
  "Travel & Gear": "🚗",
  Nursery: "🏠",
  "For Mom": "👩",
  "For Baby": "👶",
  "For Partner": "👨",
  "Documents & Essentials": "📋",
};

// ── Global State ──────────────────────────────────────────────

var gapiInited = false;
var gisInited = false;
var tokenClient = null;
var currentUser = null;
var sheetRowMap = {};
var celebratedCategories = {};

var state = {
  activeSection: "newborn-essentials",
  drawerCategory: null,
  searchQuery: "",
  activeFilter: "all",
  isOnline: false,
};

// ── DOM References (populated in initApp) ─────────────────────

var dom = {};

// ── Storage Adapter (localStorage) ────────────────────────────

var Storage = {
  _prefix: "baby-checklist-",

  isChecked: function (id) {
    return localStorage.getItem(this._prefix + id) === "1";
  },

  setChecked: function (id, checked) {
    if (checked) {
      localStorage.setItem(this._prefix + id, "1");
    } else {
      localStorage.removeItem(this._prefix + id);
    }
  },

  clearAll: function () {
    var keys = Object.keys(localStorage).filter(function (k) {
      return k.startsWith("baby-checklist-");
    });
    keys.forEach(function (k) {
      localStorage.removeItem(k);
    });
  },
};

// ── Google API Init ───────────────────────────────────────────

function gapiLoaded() {
  gapi.load("client", function () {
    gapi.client
      .init({
        discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
      })
      .then(function () {
        gapiInited = true;
        maybeEnableAuth();
      });
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.scopes,
    callback: handleAuthCallback,
  });
  gisInited = true;
  maybeEnableAuth();
}

function maybeEnableAuth() {
  if (gapiInited && gisInited) {
    var btn = document.getElementById("googleSignInBtn");
    if (btn) btn.disabled = false;
  }
}

// ── Auth Flow ─────────────────────────────────────────────────

function authorizeGoogle() {
  if (!tokenClient) return;
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleAuthCallback(resp) {
  if (resp.error) {
    console.error("Auth error:", resp);
    return;
  }

  var token = gapi.client.getToken();
  if (!token) return;

  fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + token.access_token },
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (userInfo) {
      currentUser = userInfo;
      localStorage.setItem(
        "baby-checklist-user",
        JSON.stringify(currentUser),
      );

      state.isOnline = true;
      updateAuthUI();
      syncFromSheet();
    })
    .catch(function (err) {
      console.error("Failed to get user info:", err);
    });
}

function signOut() {
  var token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken(null);
  }
  currentUser = null;
  state.isOnline = false;
  sheetRowMap = {};
  localStorage.removeItem("baby-checklist-user");
  updateAuthUI();
}

function continueOffline() {
  document.getElementById("authOverlay").style.display = "none";
  document.getElementById("offlineBanner").style.display = "";
}

function showAuthOverlay() {
  document.getElementById("offlineBanner").style.display = "none";
  document.getElementById("authOverlay").style.display = "";
}

function updateAuthUI() {
  var authOverlay = document.getElementById("authOverlay");
  var syncBar = document.getElementById("syncBar");
  var offlineBanner = document.getElementById("offlineBanner");

  if (currentUser && state.isOnline) {
    authOverlay.style.display = "none";
    offlineBanner.style.display = "none";
    syncBar.style.display = "";
    document.getElementById("syncAvatar").src =
      currentUser.picture || "";
    document.getElementById("syncUserName").textContent =
      currentUser.name || currentUser.email;
    updateSyncStatus("synced");
  } else {
    syncBar.style.display = "none";
  }
}

// ── Sheets Sync ───────────────────────────────────────────────

function getRange(cells) {
  return GOOGLE_CONFIG.sheetName + "!" + cells;
}

function ensureHeaders() {
  return gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange("A1:D1"),
    })
    .then(function (resp) {
      if (!resp.result.values || resp.result.values.length === 0) {
        return gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
          range: getRange("A1:D1"),
          valueInputOption: "RAW",
          resource: {
            values: [
              ["item_id", "checked_by", "checked", "updated_at"],
            ],
          },
        });
      }
    });
}

function syncFromSheet() {
  if (!currentUser) return;

  updateSyncStatus("syncing");

  ensureHeaders()
    .then(function () {
      return gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        range: getRange("A:D"),
      });
    })
    .then(function (resp) {
      var rows = resp.result.values || [];
      sheetRowMap = {};

      for (var i = 1; i < rows.length; i++) {
        var itemId = rows[i][0];
        var checked = rows[i][2];
        var isChecked = checked === "TRUE";

        Storage.setChecked(itemId, isChecked);
        sheetRowMap[itemId] = i + 1;
      }

      render();
      updateSyncStatus("synced");
    })
    .catch(function (err) {
      console.error("Sync from sheet failed:", err);
      updateSyncStatus("error");
    });
}

function saveToSheet(itemId, checked) {
  if (!currentUser || !state.isOnline) return;

  updateSyncStatus("syncing");

  var rowData = [
    itemId,
    currentUser.email,
    checked ? "TRUE" : "FALSE",
    new Date().toISOString(),
  ];

  var promise;

  if (sheetRowMap[itemId]) {
    var row = sheetRowMap[itemId];
    promise = gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange("A" + row + ":D" + row),
      valueInputOption: "RAW",
      resource: { values: [rowData] },
    });
  } else {
    promise = gapi.client.sheets.spreadsheets.values
      .append({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        range: getRange("A:D"),
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [rowData] },
      })
      .then(function (resp) {
        var updatedRange =
          resp.result.updates.updatedRange || "";
        var match = updatedRange.match(/A(\d+)/);
        if (match) {
          sheetRowMap[itemId] = parseInt(match[1]);
        }
      });
  }

  promise
    .then(function () {
      updateSyncStatus("synced");
    })
    .catch(function (err) {
      console.error("Save to sheet failed:", err);
      updateSyncStatus("error");
    });
}

function updateSyncStatus(status) {
  var dot = document.getElementById("syncDot");
  var text = document.getElementById("syncText");
  if (!dot || !text) return;

  dot.className = "sync-dot";
  switch (status) {
    case "syncing":
      dot.classList.add("syncing");
      text.textContent = "Syncing...";
      break;
    case "synced":
      dot.classList.add("synced");
      text.textContent = "Synced";
      break;
    case "error":
      dot.classList.add("error");
      text.textContent = "Sync error";
      break;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getMotivationalHeading(pct) {
  if (pct === 0) return "Let's get started! 🎯";
  if (pct <= 25) return "Off to a great start! 🌟";
  if (pct <= 50) return "You're getting there! 🎉";
  if (pct <= 75) return "Over halfway done! 💪";
  if (pct < 100) return "Almost there! 🏁";
  return "All done — you're amazing! 🎊";
}

function getCategoriesForSection(section) {
  var seen = {};
  var result = [];
  CHECKLIST_DATA.forEach(function (item) {
    if (item.section === section && !seen[item.category]) {
      seen[item.category] = true;
      result.push(item.category);
    }
  });
  return result;
}

function getFilteredItems() {
  return CHECKLIST_DATA.filter(function (item) {
    if (item.section !== state.activeSection) return false;

    if (state.activeFilter !== "all") {
      if (state.activeFilter === "pending") {
        if (Storage.isChecked(item.id)) return false;
      } else {
        if (item.priority !== state.activeFilter) return false;
      }
    }

    if (state.searchQuery) {
      var hay = (
        item.name +
        " " +
        item.description +
        " " +
        item.category
      ).toLowerCase();
      if (hay.indexOf(state.searchQuery) === -1) return false;
    }

    return true;
  });
}

// ── Toggle Item (unified handler) ─────────────────────────────

function toggleItem(id, checked) {
  Storage.setChecked(id, checked);
  render();
  saveToSheet(id, checked);
  if (checked) {
    checkForCompletions(id);
  }
}

// ── Render: Category Card Grid ────────────────────────────────

function renderGrid() {
  var filteredItems = getFilteredItems();
  var filteredCats = {};
  filteredItems.forEach(function (i) {
    filteredCats[i.category] = true;
  });

  var allCategories = getCategoriesForSection(state.activeSection);
  var html = "";
  var visibleCount = 0;

  allCategories.forEach(function (cat, index) {
    if (!filteredCats[cat]) return;
    visibleCount++;

    var catItems = CHECKLIST_DATA.filter(function (i) {
      return (
        i.section === state.activeSection && i.category === cat
      );
    });
    var checkedCount = catItems.filter(function (i) {
      return Storage.isChecked(i.id);
    }).length;
    var total = catItems.length;
    var pct =
      total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    var essentialsLeft = catItems.filter(function (i) {
      return i.priority === "essential" && !Storage.isChecked(i.id);
    }).length;
    var isComplete = pct === 100;
    var icon = CATEGORY_ICONS[cat] || "📦";

    html +=
      '<div class="category-card' +
      (isComplete ? " complete" : "") +
      '" data-category="' +
      cat +
      '" style="animation-delay: ' +
      index * 0.05 +
      's">';
    if (isComplete)
      html += '<div class="card-complete-badge">✓</div>';
    html += '<div class="card-icon">' + icon + "</div>";
    html += '<h3 class="card-name">' + cat + "</h3>";
    html +=
      '<p class="card-progress-text">' +
      checkedCount +
      " of " +
      total +
      " items</p>";
    html +=
      '<div class="card-progress-track"><div class="card-progress-fill" style="width:' +
      pct +
      '%"></div></div>';
    html += '<span class="card-percent">' + pct + "%</span>";
    if (essentialsLeft > 0) {
      html +=
        '<span class="card-essentials-badge">🔴 ' +
        essentialsLeft +
        " essential" +
        (essentialsLeft > 1 ? "s" : "") +
        " left</span>";
    }
    html += "</div>";
  });

  dom.categoryGrid.innerHTML = html;
  dom.emptyState.style.display = visibleCount === 0 ? "" : "none";
}

// ── Render: Hero Section ──────────────────────────────────────

function renderHero() {
  var sectionItems = CHECKLIST_DATA.filter(function (i) {
    return i.section === state.activeSection;
  });
  var total = sectionItems.length;
  var done = sectionItems.filter(function (i) {
    return Storage.isChecked(i.id);
  }).length;
  var pct = total > 0 ? Math.round((done / total) * 100) : 0;
  var essentialsLeft = sectionItems.filter(function (i) {
    return i.priority === "essential" && !Storage.isChecked(i.id);
  }).length;

  dom.heroPercent.textContent = pct + "%";
  dom.statDone.textContent = done;
  dom.statTotal.textContent = total;
  dom.statEssentials.textContent = essentialsLeft;
  dom.heroSubtext.textContent =
    done + " of " + total + " items checked off";
  dom.heroHeading.textContent = getMotivationalHeading(pct);

  var circumference = 2 * Math.PI * 52;
  var offset = circumference - (pct / 100) * circumference;
  dom.heroRingFill.style.strokeDashoffset = offset;
}

// ── Render: Drill-Down Drawer ─────────────────────────────────

function renderDrawer() {
  if (!state.drawerCategory) return;

  var cat = state.drawerCategory;
  var items = CHECKLIST_DATA.filter(function (i) {
    return i.section === state.activeSection && i.category === cat;
  });
  var checkedCount = items.filter(function (i) {
    return Storage.isChecked(i.id);
  }).length;
  var total = items.length;
  var pct =
    total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  dom.drawerIcon.textContent = CATEGORY_ICONS[cat] || "📦";
  dom.drawerName.textContent = cat;
  dom.drawerProgressText.textContent = checkedCount + " / " + total;
  dom.drawerProgressFill.style.width = pct + "%";

  var scrollTop = dom.drawerBody.scrollTop;

  var html = "";
  items.forEach(function (item) {
    var checked = Storage.isChecked(item.id);
    html += buildDrawerItemHTML(item, checked);
  });

  dom.drawerBody.innerHTML = html;
  dom.drawerBody.scrollTop = scrollTop;
}

function buildDrawerItemHTML(item, checked) {
  var checkedClass = checked ? " checked" : "";
  var checkedAttr = checked ? " checked" : "";
  var priorityLabel =
    item.priority === "nice-to-have"
      ? "Nice to Have"
      : item.priority.charAt(0).toUpperCase() +
        item.priority.slice(1);
  var qtyLabel =
    item.quantity > 1
      ? '<span class="item-qty">×' + item.quantity + "</span>"
      : "";

  return (
    '<div class="drawer-item priority-' +
    item.priority +
    checkedClass +
    '" data-id="' +
    item.id +
    '">' +
    '<label class="checkbox-wrapper" onclick="event.stopPropagation()">' +
    "<input type=\"checkbox\"" +
    checkedAttr +
    ' data-id="' +
    item.id +
    '">' +
    '<span class="custom-checkbox">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="20 6 9 17 4 12"/>' +
    "</svg>" +
    "</span>" +
    "</label>" +
    '<div class="item-content">' +
    '<div class="item-top-row">' +
    '<span class="item-name">' +
    item.name +
    "</span>" +
    qtyLabel +
    '<span class="priority-badge ' +
    item.priority +
    '">' +
    priorityLabel +
    "</span>" +
    "</div>" +
    '<div class="item-description">' +
    item.description +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

// ── Master Render ─────────────────────────────────────────────

function render() {
  renderGrid();
  renderHero();
  renderDrawer();
}

// ── Drawer Lifecycle ──────────────────────────────────────────

function openDrawer(category) {
  state.drawerCategory = category;
  renderDrawer();
  requestAnimationFrame(function () {
    dom.drawer.classList.add("open");
    dom.drawerOverlay.classList.add("active");
  });
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  dom.drawer.classList.remove("open");
  dom.drawerOverlay.classList.remove("active");
  document.body.style.overflow = "";

  dom.drawer.addEventListener(
    "transitionend",
    function () {
      if (!dom.drawer.classList.contains("open")) {
        state.drawerCategory = null;
        dom.drawerBody.innerHTML = "";
      }
    },
    { once: true },
  );
}

// ── Event Handlers ────────────────────────────────────────────

function onCheckboxChange(e) {
  if (
    e.target.tagName === "INPUT" &&
    e.target.type === "checkbox" &&
    e.target.dataset.id
  ) {
    toggleItem(e.target.dataset.id, e.target.checked);
  }
}

function onDrawerItemClick(e) {
  var item = e.target.closest(".drawer-item");
  if (!item) return;
  if (e.target.closest(".checkbox-wrapper")) return;

  var id = item.dataset.id;
  var isChecked = Storage.isChecked(id);
  toggleItem(id, !isChecked);
}

function onCardClick(e) {
  var card = e.target.closest(".category-card");
  if (!card) return;
  openDrawer(card.dataset.category);
}

function onTabClick(e) {
  var tab = e.target.closest(".tab");
  if (!tab) return;
  var section = tab.dataset.section;
  if (section === state.activeSection) return;

  state.activeSection = section;

  dom.sectionTabs.querySelectorAll(".tab").forEach(function (t) {
    t.classList.toggle(
      "active",
      t.dataset.section === section,
    );
  });

  if (state.drawerCategory) closeDrawer();
  render();
}

function onPillClick(e) {
  var pill = e.target.closest(".pill");
  if (!pill) return;
  var filter = pill.dataset.filter;

  state.activeFilter = filter;

  dom.filterPills.querySelectorAll(".pill").forEach(function (p) {
    p.classList.toggle("active", p.dataset.filter === filter);
  });

  render();
}

var searchTimeout;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    state.searchQuery = dom.searchInput.value
      .toLowerCase()
      .trim();
    render();
  }, 200);
}

function onKeyDown(e) {
  if (e.key === "Escape" && state.drawerCategory) {
    closeDrawer();
  }
}

// ── Dark Mode ─────────────────────────────────────────────────

function initTheme() {
  var saved = localStorage.getItem("baby-checklist-theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  updateThemeIcon();

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      if (!localStorage.getItem("baby-checklist-theme")) {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
        updateThemeIcon();
      }
    });
  }
}

function toggleTheme() {
  var current =
    document.documentElement.getAttribute("data-theme");
  var next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("baby-checklist-theme", next);
  updateThemeIcon();
}

function updateThemeIcon() {
  var icon = document.getElementById("themeIcon");
  if (!icon) return;
  var isDark =
    document.documentElement.getAttribute("data-theme") === "dark";
  icon.textContent = isDark ? "☀️" : "🌙";
}

// ── Confetti ──────────────────────────────────────────────────

function checkForCompletions(itemId) {
  var item = CHECKLIST_DATA.find(function (i) {
    return i.id === itemId;
  });
  if (!item) return;

  var catItems = CHECKLIST_DATA.filter(function (i) {
    return (
      i.section === item.section && i.category === item.category
    );
  });
  var allChecked = catItems.every(function (i) {
    return Storage.isChecked(i.id);
  });

  var catKey = item.section + "|" + item.category;
  if (allChecked && !celebratedCategories[catKey]) {
    celebratedCategories[catKey] = true;
    setTimeout(launchConfetti, 300);
  }

  var sectionItems = CHECKLIST_DATA.filter(function (i) {
    return i.section === item.section;
  });
  var sectionComplete = sectionItems.every(function (i) {
    return Storage.isChecked(i.id);
  });
  var sectionKey = "section-" + item.section;
  if (sectionComplete && !celebratedCategories[sectionKey]) {
    celebratedCategories[sectionKey] = true;
    setTimeout(launchConfetti, 500);
    setTimeout(launchConfetti, 900);
  }
}

function launchConfetti() {
  var canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;z-index:999;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  var colors = [
    "#6c63ff",
    "#ff6b9d",
    "#34d399",
    "#f59e0b",
    "#ef4444",
    "#a78bfa",
    "#06b6d4",
  ];
  var particles = [];

  for (var i = 0; i < 120; i++) {
    particles.push({
      x:
        canvas.width * 0.5 +
        (Math.random() - 0.5) * canvas.width * 0.5,
      y: canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 20 - 5,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  var frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = false;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.007;

      if (p.opacity <= 0) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(
        -p.size / 2,
        -p.size / 2,
        p.size,
        p.size * 0.6,
      );
      ctx.restore();
    }

    frame++;
    if (alive && frame < 200) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(animate);
}

// ── Init ──────────────────────────────────────────────────────

function initApp() {
  dom = {
    sectionTabs: document.getElementById("sectionTabs"),
    heroRingFill: document.getElementById("heroRingFill"),
    heroPercent: document.getElementById("heroPercent"),
    heroHeading: document.getElementById("heroHeading"),
    heroSubtext: document.getElementById("heroSubtext"),
    statDone: document.getElementById("statDone"),
    statTotal: document.getElementById("statTotal"),
    statEssentials: document.getElementById("statEssentials"),
    searchInput: document.getElementById("searchInput"),
    filterPills: document.getElementById("filterPills"),
    categoryGrid: document.getElementById("categoryGrid"),
    emptyState: document.getElementById("emptyState"),
    drawer: document.getElementById("drawer"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    drawerIcon: document.getElementById("drawerIcon"),
    drawerName: document.getElementById("drawerName"),
    drawerClose: document.getElementById("drawerClose"),
    drawerProgressFill: document.getElementById("drawerProgressFill"),
    drawerProgressText: document.getElementById("drawerProgressText"),
    drawerBody: document.getElementById("drawerBody"),
  };

  document.addEventListener("change", onCheckboxChange);
  dom.drawerBody.addEventListener("click", onDrawerItemClick);
  dom.categoryGrid.addEventListener("click", onCardClick);
  dom.sectionTabs.addEventListener("click", onTabClick);
  dom.filterPills.addEventListener("click", onPillClick);
  dom.searchInput.addEventListener("input", onSearchInput);
  dom.drawerClose.addEventListener("click", closeDrawer);
  dom.drawerOverlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", onKeyDown);

  render();
}

// ── Bootstrap ─────────────────────────────────────────────────

window.onload = function () {
  initTheme();
  if (typeof gapi !== "undefined") {
    gapiLoaded();
  }
  if (typeof google !== "undefined") {
    gisLoaded();
  }
  initApp();
};
