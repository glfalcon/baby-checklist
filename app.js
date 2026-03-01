/* ============================================================
   APP LOGIC — Baby Checklist v2.0
   ============================================================
   Handles: Google Sign-In, Sheets sync, multi-user,
   section tabs, hero stats, filter pills, category card grid,
   drill-down drawer, checkbox persistence, add/delete items.

   Storage strategy:
   - localStorage = fast local cache (always available)
   - Google Sheets = source of truth (when signed in)
     • Checklist tab: checked states
     • CustomItems tab: user-added items
     • DeletedItems tab: soft-deleted item IDs
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
  customItemsSheet: "CustomItems",
  deletedItemsSheet: "DeletedItems",
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
var customItems = [];
var deletedItemIds = {};

var state = {
  activeSection: "newborn-essentials",
  drawerCategory: null,
  searchQuery: "",
  activeFilter: "all",
  isOnline: false,
};

// ── DOM References (populated in initApp) ─────────────────────

var dom = {};

// ── getAllItems — merges built-in + custom, filters deleted ───

function getAllItems() {
  return CHECKLIST_DATA.concat(customItems).filter(function (item) {
    return !deletedItemIds[item.id];
  });
}

// ── Storage Adapter (localStorage) ────────────────────────────

var Storage = {
  _prefix: "baby-checklist-",
  _statusPrefix: "baby-checklist-status-",
  _completedAtPrefix: "baby-checklist-completed-",

  isChecked: function (id) {
    return localStorage.getItem(this._prefix + id) === "1";
  },

  setChecked: function (id, checked) {
    if (checked) {
      localStorage.setItem(this._prefix + id, "1");
      // Store completion date
      if (!this.getCompletedAt(id)) {
        localStorage.setItem(this._completedAtPrefix + id, new Date().toISOString());
      }
      // Clear in-progress status when marking as done
      localStorage.removeItem(this._statusPrefix + id);
    } else {
      localStorage.removeItem(this._prefix + id);
      localStorage.removeItem(this._completedAtPrefix + id);
    }
  },

  // Status: "in-progress" or null (to-do)
  getStatus: function (id) {
    return localStorage.getItem(this._statusPrefix + id);
  },

function gisLoaded() {
  // Initialize Google Sign-In with the new Identity Services API
  google.accounts.id.initialize({
    client_id: GOOGLE_CONFIG.clientId,
    callback: handleCredentialResponse,
    auto_select: true,
    context: 'signin',
  });

  // Render the Google Sign-In button
  google.accounts.id.renderButton(
    document.getElementById("googleSignInContainer"),
    {
      theme: "outline",
      size: "large",
      width: 280,
      text: "signin_with",
      shape: "rectangular",
    }
  );

  // Set up token client - use redirect mode for PWA compatibility
  var uxMode = isPWAStandalone() ? "redirect" : "popup";

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.scopes,
    ux_mode: uxMode,
    callback: uxMode === "popup" ? handleTokenCallback : undefined,
    redirect_uri: uxMode === "redirect" ? window.location.origin + window.location.pathname : undefined,
  });

  gisInited = true;
  maybeEnableAuth();

  // Check if we're returning from a redirect auth flow
  checkRedirectAuth();
}

function checkRedirectAuth() {
  // Check URL for access token from redirect flow
  var hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    var params = new URLSearchParams(hash.substring(1));
    var accessToken = params.get("access_token");
    var expiresIn = params.get("expires_in");

    if (accessToken) {
      // Set the token manually
      gapi.client.setToken({
        access_token: accessToken,
        expires_in: expiresIn,
      });

      // Clear the hash from URL
      history.replaceState(null, "", window.location.pathname);

      // Continue with auth
      state.isOnline = true;
      updateAuthUI();
      syncFromSheet();
    }
  }
}

function isPWAStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function maybeEnableAuth() {
  // Button is rendered by Google, no need to enable it
  if (gapiInited && gisInited) {
    // Check for existing session
    var savedUser = localStorage.getItem("baby-checklist-user");
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        // Request token silently to access Sheets
        requestSheetsAccess();
      } catch (e) {
        localStorage.removeItem("baby-checklist-user");
      }
    }
    
    // Check if Google button rendered, show fallback if not
    checkGoogleButtonRendered();
  }
}

function checkGoogleButtonRendered() {
  // Wait a bit for Google's button to render
  setTimeout(function() {
    var container = document.getElementById("googleSignInContainer");
    var fallbackBtn = document.getElementById("fallbackSignInBtn");
    
    // If container is empty or has no visible content, show fallback
    if (container && fallbackBtn) {
      var hasGoogleButton = container.querySelector('iframe') || 
                            container.querySelector('div[role="button"]') ||
                            container.children.length > 0;
      
      if (!hasGoogleButton) {
        console.log("Google Sign-In button did not render, showing fallback");
        fallbackBtn.style.display = "flex";
      }
    }
  }, 1500); // Give Google 1.5 seconds to render
}

function fallbackSignIn() {
  // Directly trigger the OAuth flow using the token client
  if (!tokenClient) {
    console.error("Token client not initialized");
    return;
  }
  
  // For PWA, use redirect flow; otherwise use popup
  if (isPWAStandalone()) {
    // Redirect flow - will navigate away and return with token
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    // Popup flow with consent prompt
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
}

// ── Auth Flow ─────────────────────────────────────────────────

function handleCredentialResponse(response) {
  // Decode the JWT credential to get user info
  var payload = parseJwt(response.credential);
  if (!payload) {
    console.error("Failed to parse credential");
    return;
  }

  currentUser = {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub,
  };
  localStorage.setItem("baby-checklist-user", JSON.stringify(currentUser));

  // Request Sheets API access
  requestSheetsAccess();
}

function requestSheetsAccess() {
  if (!tokenClient) return;

  // Check if we already have a valid token
  if (gapi.client.getToken() !== null) {
    state.isOnline = true;
    updateAuthUI();
    syncFromSheet();
  } else {
    // Request access token - will use redirect in PWA mode, popup otherwise
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleTokenCallback(resp) {
  if (resp.error) {
    console.error("Token error:", resp);
    // Still show the app, but in degraded mode
    if (currentUser) {
      state.isOnline = false;
      updateAuthUI();
      render();
    }
    return;
  }

  state.isOnline = true;
  updateAuthUI();
  syncFromSheet();
}

function parseJwt(token) {
  try {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function authorizeGoogle() {
  // Legacy function - kept for compatibility
  requestSheetsAccess();
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
  customItems = [];
  deletedItemIds = {};
  localStorage.removeItem("baby-checklist-user");
  updateAuthUI();
  render();
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

// ── Sheet Helpers ─────────────────────────────────────────────

function getRange(sheet, cells) {
  return sheet + "!" + cells;
}

function ensureSheet(sheetName, headers) {
  return gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange(sheetName, "A1:Z1"),
    })
    .then(function (resp) {
      if (!resp.result.values || resp.result.values.length === 0) {
        return gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
          range: getRange(sheetName, "A1"),
          valueInputOption: "RAW",
          resource: { values: [headers] },
        });
      }
    })
    .catch(function () {
      return gapi.client.sheets.spreadsheets
        .batchUpdate({
          spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
          resource: {
            requests: [
              { addSheet: { properties: { title: sheetName } } },
            ],
          },
        })
        .then(function () {
          return gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
            range: getRange(sheetName, "A1"),
            valueInputOption: "RAW",
            resource: { values: [headers] },
          });
        });
    });
}

// ── Sheets Sync ───────────────────────────────────────────────

function syncFromSheet() {
  if (!currentUser) return;

  updateSyncStatus("syncing");

  var checklist = GOOGLE_CONFIG.sheetName;
  var custom = GOOGLE_CONFIG.customItemsSheet;
  var deleted = GOOGLE_CONFIG.deletedItemsSheet;

  ensureSheet(checklist, [
    "item_id",
    "checked_by",
    "checked",
    "updated_at",
  ])
    .then(function () {
      return ensureSheet(custom, [
        "item_id",
        "section",
        "category",
        "name",
        "description",
        "priority",
        "quantity",
        "added_by",
        "added_at",
      ]);
    })
    .then(function () {
      return ensureSheet(deleted, [
        "item_id",
        "deleted_by",
        "deleted_at",
      ]);
    })
    .then(function () {
return gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        ranges: [
          getRange(checklist, "A:F"),
          getRange(custom, "A:I"),
          getRange(deleted, "A:C"),
        ],
      });
    })
.then(function (resp) {
      var ranges = resp.result.valueRanges;

      // Checked states
      var checklistRows = (ranges[0] && ranges[0].values) || [];
sheetRowMap = {};
      for (var i = 1; i < checklistRows.length; i++) {
        var row = checklistRows[i];
        var itemId = row[0];
        if (!itemId) continue;

        sheetRowMap[itemId] = i + 1;

        var checked = row[2] === "TRUE";
        var status = row[4] || null; // Column E = status
        var completedAt = row[5] || null; // Column F = completedAt

        Storage.setChecked(itemId, checked);
        if (status) {
          Storage.setStatus(itemId, status);
        } else {
          Storage.setStatus(itemId, null);
        }
        if (completedAt) {
          Storage.setCompletedAt(itemId, completedAt);
        } else {
          Storage.setCompletedAt(itemId, null);
        }
      }

// Custom items
      var customRows = (ranges[1] && ranges[1].values) || [];
      customItems = [];
      for (var j = 1; j < customRows.length; j++) {
        var r = customRows[j];
        if (r[0]) {
          customItems.push({
            id: r[0],
            section: r[1] || "newborn-essentials",
            category: r[2] || "Uncategorized",
            name: r[3] || "Unnamed Item",
            description: r[4] || "",
            priority: r[5] || "recommended",
            quantity: parseInt(r[6]) || 1,
            addedAt: r[8] || null,
          });
        }
      }

      // Deleted items
      var deletedRows = (ranges[2] && ranges[2].values) || [];
      deletedItemIds = {};
      for (var k = 1; k < deletedRows.length; k++) {
        if (deletedRows[k][0]) {
          deletedItemIds[deletedRows[k][0]] = true;
        }
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

  var status = Storage.getStatus(itemId) || "";
  var completedAt = checked ? new Date().toISOString() : "";

  var rowData = [
    itemId,
    currentUser.email,
    checked ? "TRUE" : "FALSE",
    new Date().toISOString(),
    status,
    completedAt,
  ];

  var promise;
  var sheet = GOOGLE_CONFIG.sheetName;

  if (sheetRowMap[itemId]) {
    var row = sheetRowMap[itemId];
    promise = gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange(sheet, "A" + row + ":F" + row),
      valueInputOption: "RAW",
      resource: { values: [rowData] },
    });
  } else {
    promise = gapi.client.sheets.spreadsheets.values
      .append({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        range: getRange(sheet, "A:F"),
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

function saveCustomItemToSheet(item) {
  if (!currentUser || !state.isOnline) return;

  updateSyncStatus("syncing");

  var rowData = [
    item.id,
    item.section,
    item.category,
    item.name,
    item.description,
    item.priority,
    item.quantity.toString(),
    currentUser.email,
    new Date().toISOString(),
  ];

  gapi.client.sheets.spreadsheets.values
    .append({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange(GOOGLE_CONFIG.customItemsSheet, "A:I"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [rowData] },
    })
    .then(function () {
      updateSyncStatus("synced");
    })
    .catch(function (err) {
      console.error("Save custom item failed:", err);
      updateSyncStatus("error");
    });
}

function saveDeletedItemToSheet(itemId) {
  if (!currentUser || !state.isOnline) return;

  updateSyncStatus("syncing");

  var rowData = [
    itemId,
    currentUser.email,
    new Date().toISOString(),
  ];

  gapi.client.sheets.spreadsheets.values
    .append({
      spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
      range: getRange(GOOGLE_CONFIG.deletedItemsSheet, "A:C"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [rowData] },
    })
    .then(function () {
      updateSyncStatus("synced");
    })
    .catch(function (err) {
      console.error("Save deleted item failed:", err);
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
  getAllItems().forEach(function (item) {
    if (item.section === section && !seen[item.category]) {
      seen[item.category] = true;
      result.push(item.category);
    }
  });
  return result;
}

function getFilteredItems() {
  return getAllItems().filter(function (item) {
    if (item.section !== state.activeSection) return false;

if (state.activeFilter !== "all") {
      if (state.activeFilter === "outstanding") {
        // Outstanding = not done yet (includes to-do and in-progress)
        if (Storage.isChecked(item.id)) return false;
      } else if (state.activeFilter === "in-progress") {
        // In Progress only
        if (Storage.getStatus(item.id) !== "in-progress") return false;
        if (Storage.isChecked(item.id)) return false;
      } else if (state.activeFilter === "completed") {
        // Completed only
        if (!Storage.isChecked(item.id)) return false;
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

function generateItemId() {
  return (
    "custom-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substr(2, 5)
  );
}

function isNewItem(item) {
  if (!item.addedAt) return false;
  var addedDate = new Date(item.addedAt);
  var threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return addedDate.getTime() > threeDaysAgo;
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

// ── Delete Item ───────────────────────────────────────────────

function removeItem(id) {
  if (!confirm("Remove this item from the checklist?")) return;

  deletedItemIds[id] = true;
  saveDeletedItemToSheet(id);

  render();

  // Close drawer if category is now empty
  if (state.drawerCategory) {
    var remaining = getAllItems().filter(function (i) {
      return (
        i.section === state.activeSection &&
        i.category === state.drawerCategory
      );
    });
    if (remaining.length === 0) {
      closeDrawer();
    } else {
      renderDrawer();
    }
  }
}

// ── Add Item Modal ────────────────────────────────────────────

function openAddModal() {
  var modal = document.getElementById("addItemModal");
  modal.style.display = "";
  document.getElementById("addSection").value =
    state.activeSection;
  updateCategoryOptions();
  document.getElementById("addName").value = "";
  document.getElementById("addDescription").value = "";
  document.getElementById("addQuantity").value = "1";
  document.getElementById("newCategoryGroup").style.display =
    "none";
  document.getElementById("addNewCategory").value = "";

  var btns = document.querySelectorAll(".priority-btn");
  btns.forEach(function (b) {
    b.classList.toggle(
      "active",
      b.dataset.priority === "essential",
    );
  });

  document.body.style.overflow = "hidden";
}

function closeAddModal() {
  document.getElementById("addItemModal").style.display = "none";
  document.body.style.overflow = "";
}

function updateCategoryOptions() {
  var section = document.getElementById("addSection").value;
  var select = document.getElementById("addCategory");
  var categories = getCategoriesForSection(section);

  var html =
    '<option value="" disabled selected>Select a category...</option>';
  categories.forEach(function (cat) {
    var icon = CATEGORY_ICONS[cat] || "📦";
    html +=
      '<option value="' +
      cat +
      '">' +
      icon +
      " " +
      cat +
      "</option>";
  });
  html += '<option value="__new__">➕ New Category...</option>';

  select.innerHTML = html;
  handleCategoryChange();
}

function handleCategoryChange() {
  var val = document.getElementById("addCategory").value;
  var newGroup = document.getElementById("newCategoryGroup");
  newGroup.style.display = val === "__new__" ? "" : "none";
}

function handleAddItem(e) {
  e.preventDefault();

  var section = document.getElementById("addSection").value;
  var categoryVal = document.getElementById("addCategory").value;
  var category =
    categoryVal === "__new__"
      ? document.getElementById("addNewCategory").value.trim()
      : categoryVal;

  if (!category) {
    alert("Please enter a category name.");
    return;
  }

  var name = document.getElementById("addName").value.trim();
  if (!name) return;

  var description = document
    .getElementById("addDescription")
    .value.trim();
  var quantity =
    parseInt(document.getElementById("addQuantity").value) || 1;

  var activeBtn = document.querySelector(".priority-btn.active");
  var priority = activeBtn
    ? activeBtn.dataset.priority
    : "recommended";

var newItem = {
    id: generateItemId(),
    section: section,
    category: category,
    name: name,
    description: description,
    priority: priority,
    quantity: quantity,
    addedAt: new Date().toISOString(),
  };

  customItems.push(newItem);
  saveCustomItemToSheet(newItem);

  closeAddModal();
  render();

  // Open the drawer to the newly added category if on the right section
  if (section === state.activeSection) {
    openDrawer(category);
  }
}

// ── Priority Selector ─────────────────────────────────────────

function initPrioritySelector() {
  var container = document.getElementById("prioritySelector");
  if (!container) return;

  container.addEventListener("click", function (e) {
    var btn = e.target.closest(".priority-btn");
    if (!btn) return;

    container.querySelectorAll(".priority-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
  });
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

    var catItems = getAllItems().filter(function (i) {
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
    var newItemsCount = catItems.filter(function (i) {
      return isNewItem(i);
    }).length;
    var inProgressCount = catItems.filter(function (i) {
      return !Storage.isChecked(i.id) && Storage.getStatus(i.id) === "in-progress";
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
    if (newItemsCount > 0)
      html += '<div class="card-new-badge">' + newItemsCount + ' new</div>';
    if (inProgressCount > 0)
      html += '<div class="card-progress-badge">🟡 ' + inProgressCount + ' in progress</div>';
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
  var sectionItems = getAllItems().filter(function (i) {
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
  var items = getAllItems().filter(function (i) {
    return i.section === state.activeSection && i.category === cat;
  });

  // Sort by priority: essential first, then recommended, then nice-to-have
  function getPriorityOrder(priority) {
    if (priority === "essential") return 0;
    if (priority === "recommended") return 1;
    if (priority === "nice-to-have") return 2;
    return 3;
  }
  items.sort(function (a, b) {
    return getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
  });

  // Split into active and completed
  var activeItems = items.filter(function (i) {
    return !Storage.isChecked(i.id);
  });
  var completedItems = items.filter(function (i) {
    return Storage.isChecked(i.id);
  });

  var checkedCount = completedItems.length;
  var total = items.length;
  var pct =
    total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  dom.drawerIcon.textContent = CATEGORY_ICONS[cat] || "📦";
  dom.drawerName.textContent = cat;
  dom.drawerProgressText.textContent = checkedCount + " / " + total;
  dom.drawerProgressFill.style.width = pct + "%";

  var scrollTop = dom.drawerBody.scrollTop;

  var html = "";

  // Active items first
  activeItems.forEach(function (item) {
    html += buildDrawerItemHTML(item, false);
  });

  // Collapsible completed section
  if (completedItems.length > 0) {
    var isExpanded = state.completedExpanded !== false; // default to expanded
    html += '<div class="completed-section">';
    html += '<button class="completed-toggle" onclick="toggleCompletedSection()">';
    html += '<span class="completed-toggle-icon">' + (isExpanded ? '▼' : '▶') + '</span>';
    html += '<span class="completed-toggle-text">Completed (' + completedItems.length + ')</span>';
    html += '</button>';
    html += '<div class="completed-items' + (isExpanded ? ' expanded' : '') + '">';
    completedItems.forEach(function (item) {
      html += buildDrawerItemHTML(item, true);
    });
    html += '</div>';
    html += '</div>';
  }

  dom.drawerBody.innerHTML = html;
  dom.drawerBody.scrollTop = scrollTop;
}

function toggleCompletedSection() {
  state.completedExpanded = !state.completedExpanded;
  renderDrawer();
}

function buildDrawerItemHTML(item, checked) {
  var status = Storage.getStatus(item.id);
  var checkedClass = checked ? " checked" : "";
  var statusClass = status === "in-progress" ? " in-progress" : "";
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
  var newBadge = isNewItem(item)
    ? '<span class="new-badge" aria-label="Recently added">NEW</span>'
    : "";
  var statusBadge = (!checked && status === "in-progress")
    ? '<span class="status-badge in-progress" aria-label="In progress">🟡</span>'
    : "";

// Hover actions removed - using click-to-open-status instead

  return (
    '<div class="drawer-item priority-' +
    item.priority +
    checkedClass +
    statusClass +
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
    statusBadge +
    newBadge +
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
    '<button class="item-delete" data-delete-id="' +
    item.id +
    '" onclick="event.stopPropagation(); removeItem(\'' +
    item.id +
    '\')" aria-label="Delete">✕</button>' +
    "</div>"
  );
}

// ── Master Render ─────────────────────────────────────────────

function render() {
  if (state.activeSection === "completed-view") {
    renderCompletedView();
    renderHero();
  } else {
    renderGrid();
    renderHero();
    renderDrawer();
  }
}

// ── Completed View ────────────────────────────────────────────

function renderCompletedView() {
  var completedItems = getAllItems().filter(function (item) {
    return Storage.isChecked(item.id);
  });

  // Sort by completion date (most recent first)
  completedItems.sort(function (a, b) {
    var dateA = Storage.getCompletedAt(a.id) || "1970-01-01";
    var dateB = Storage.getCompletedAt(b.id) || "1970-01-01";
    return new Date(dateB) - new Date(dateA);
  });

  var html = "";

  if (completedItems.length === 0) {
    html = '<div class="completed-empty">';
    html += '<span class="completed-empty-icon">📦</span>';
    html += '<h3>No completed items yet</h3>';
    html += '<p>Items you mark as done will appear here.</p>';
    html += '</div>';
  } else {
    html = '<div class="completed-list">';

    completedItems.forEach(function (item) {
      var completedAt = Storage.getCompletedAt(item.id);
      var dateStr = completedAt ? formatCompletedDate(completedAt) : "—";
      var icon = CATEGORY_ICONS[item.category] || "📦";
      var sectionIcon = item.section === "hospital-bag" ? "🏥" : "👶";

      html += '<div class="completed-card">';
      html += '<div class="completed-card-header">';
      html += '<span class="completed-card-name">' + item.name + '</span>';
      html += '<span class="completed-card-section">' + sectionIcon + '</span>';
      html += '</div>';
      html += '<div class="completed-card-meta">';
      html += '<span class="completed-card-category">' + icon + ' ' + item.category + '</span>';
      html += '<span class="completed-card-date">✓ ' + dateStr + '</span>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
  }

  dom.categoryGrid.innerHTML = html;
  dom.emptyState.style.display = "none";
}

function formatCompletedDate(isoString) {
  var date = new Date(isoString);
  var now = new Date();
  var diffMs = now - date;
  var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return diffDays + " days ago";
  } else {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
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
  // Status sheet click handler in initStatusSheet() handles this now
  // This function is kept but disabled to avoid double-handling
  return;
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
  if (e.key === "Escape") {
    if (
      document.getElementById("addItemModal").style.display !== "none"
    ) {
      closeAddModal();
    } else if (state.drawerCategory) {
      closeDrawer();
    }
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
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function (e) {
        if (!localStorage.getItem("baby-checklist-theme")) {
          document.documentElement.setAttribute(
            "data-theme",
            e.matches ? "dark" : "light",
          );
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
  var allItems = getAllItems();
  var item = allItems.find(function (i) {
    return i.id === itemId;
  });
  if (!item) return;

  var catItems = allItems.filter(function (i) {
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

  var sectionItems = allItems.filter(function (i) {
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

  initPrioritySelector();
  render();
}

// ── Bootstrap ─────────────────────────────────────────────────

var statusSheetItemId = null;
var longPressTimer = null;
var longPressTriggered = false;

function openStatusSheet(itemId, itemName) {
  statusSheetItemId = itemId;
  document.getElementById("statusSheetTitle").textContent = itemName || "Set Status";
  document.getElementById("statusSheetOverlay").classList.add("active");
  document.getElementById("statusSheet").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeStatusSheet() {
  statusSheetItemId = null;
  document.getElementById("statusSheetOverlay").classList.remove("active");
  document.getElementById("statusSheet").classList.remove("open");
  document.body.style.overflow = "";
}

function setItemStatus(status) {
  if (!statusSheetItemId) return;
  Storage.setStatus(statusSheetItemId, status);
  if (state.isOnline) {
    syncStatusToSheet(statusSheetItemId, status);
  }
  closeStatusSheet();
  render();
}

function setItemStatusDone() {
  if (!statusSheetItemId) return;
  Storage.setChecked(statusSheetItemId, true);
  if (state.isOnline) {
    syncCheckToSheet(statusSheetItemId, true);
  }
  closeStatusSheet();
  render();
}

// Quick actions for desktop hover buttons
function quickSetStatus(itemId, status) {
  var currentStatus = Storage.getStatus(itemId);
  // Toggle: if already this status, clear it
  var newStatus = (currentStatus === status) ? null : status;
  Storage.setStatus(itemId, newStatus);
  if (state.isOnline) {
    syncStatusToSheet(itemId, newStatus);
  }
  render();
}

function quickSetDone(itemId) {
  var isChecked = Storage.isChecked(itemId);
  Storage.setChecked(itemId, !isChecked);
  if (state.isOnline) {
    syncCheckToSheet(itemId, !isChecked);
  }
  render();
}

function syncStatusToSheet(itemId, status) {
  if (!state.isOnline) return;

  if (sheetRowMap[itemId]) {
    // Update existing row - column E for status
    var row = sheetRowMap[itemId];
    gapi.client.sheets.spreadsheets.values
      .update({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        range: GOOGLE_CONFIG.sheetName + "!E" + row,
        valueInputOption: "RAW",
        resource: {
          values: [[status || ""]],
        },
      })
      .then(function () {
        console.log("Status synced:", itemId, status);
      })
      .catch(function (err) {
        console.error("Status sync failed:", err);
      });
  } else {
    // New item - append row with status in column E
    gapi.client.sheets.spreadsheets.values
      .append({
        spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
        range: GOOGLE_CONFIG.sheetName + "!A:E",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [
            [
              itemId,
              currentUser.email,
              "FALSE",
              new Date().toISOString(),
              status || "",
            ],
          ],
        },
      })
      .then(function (response) {
        var range = response.result.updates.updatedRange;
        var match = range.match(/:E(\d+)$/);
        if (match) {
          sheetRowMap[itemId] = parseInt(match[1]);
        }
        console.log("Status appended:", itemId, status);
      })
      .catch(function (err) {
        console.error("Status append failed:", err);
      });
  }
}

function initStatusSheet() {
  var overlay = document.getElementById("statusSheetOverlay");
  overlay.addEventListener("click", closeStatusSheet);

  // Click on drawer item (not checkbox/delete) to open status menu
  document.getElementById("drawerBody").addEventListener("click", function (e) {
    // Ignore if clicking checkbox, delete button, or their children
    if (e.target.closest(".checkbox-wrapper") || e.target.closest(".item-delete")) return;

    var item = e.target.closest(".drawer-item");
    if (!item) return;

    var itemId = item.dataset.id;
    var itemName = item.querySelector(".item-name").textContent;
    openStatusSheet(itemId, itemName);
  });

  // Long press for mobile (as backup / for users who expect it)
  document.getElementById("drawerBody").addEventListener("touchstart", function (e) {
    var item = e.target.closest(".drawer-item");
    if (!item) return;
    // Don't interfere with checkbox taps
    if (e.target.closest(".checkbox-wrapper") || e.target.closest(".item-delete")) return;
    longPressTriggered = false;
    longPressTimer = setTimeout(function () {
      longPressTriggered = true;
      e.preventDefault();
      var itemId = item.dataset.id;
      var itemName = item.querySelector(".item-name").textContent;
      openStatusSheet(itemId, itemName);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  }, { passive: false });

  document.getElementById("drawerBody").addEventListener("touchend", function (e) {
    clearTimeout(longPressTimer);
    if (longPressTriggered) {
      e.preventDefault();
    }
  });

  document.getElementById("drawerBody").addEventListener("touchmove", function () {
    clearTimeout(longPressTimer);
  });
}

window.onload = function () {
  initTheme();
  if (typeof gapi !== "undefined") {
    gapiLoaded();
  }
  if (typeof google !== "undefined") {
    gisLoaded();
  }
  initApp();
  initStatusSheet();
};
