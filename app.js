/* ============================================================
   APP LOGIC — Baby Checklist v2.0 (Category Dashboard)
   ============================================================
   Handles: section tabs, hero stats, filter pills, category
   card grid, drill-down drawer, checkbox persistence, and
   real-time progress updates across all components.

   Data storage:
   - NOW:    localStorage (per-item checked state keyed by item.id)
   - FUTURE: Google Sheets API v4
   ============================================================ */

(function () {
  "use strict";

  // ── Category Icons ──────────────────────────────────────────
  const CATEGORY_ICONS = {
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

  // ── Storage Adapter ─────────────────────────────────────────
  const Storage = {
    _prefix: "baby-checklist-",

    isChecked(id) {
      return localStorage.getItem(this._prefix + id) === "1";
    },

    setChecked(id, checked) {
      if (checked) {
        localStorage.setItem(this._prefix + id, "1");
      } else {
        localStorage.removeItem(this._prefix + id);
      }
    },

    clearAll() {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(this._prefix),
      );
      keys.forEach((k) => localStorage.removeItem(k));
    },
  };

  // ── Application State ───────────────────────────────────────
  const state = {
    activeSection: "newborn-essentials",
    drawerCategory: null,
    searchQuery: "",
    activeFilter: "all",
  };

  // ── DOM References ──────────────────────────────────────────
  const dom = {
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

  // ── Helpers ─────────────────────────────────────────────────

  function getMotivationalHeading(pct) {
    if (pct === 0) return "Let's get started! 🎯";
    if (pct <= 25) return "Off to a great start! 🌟";
    if (pct <= 50) return "You're getting there! 🎉";
    if (pct <= 75) return "Over halfway done! 💪";
    if (pct < 100) return "Almost there! 🏁";
    return "All done — you're amazing! 🎊";
  }

  function getCategoriesForSection(section) {
    const seen = new Set();
    const result = [];
    CHECKLIST_DATA.forEach((item) => {
      if (item.section === section && !seen.has(item.category)) {
        seen.add(item.category);
        result.push(item.category);
      }
    });
    return result;
  }

  function getFilteredItems() {
    return CHECKLIST_DATA.filter((item) => {
      if (item.section !== state.activeSection) return false;

      if (state.activeFilter !== "all") {
        if (state.activeFilter === "pending") {
          if (Storage.isChecked(item.id)) return false;
        } else {
          if (item.priority !== state.activeFilter) return false;
        }
      }

      if (state.searchQuery) {
        const hay =
          `${item.name} ${item.description} ${item.category}`.toLowerCase();
        if (!hay.includes(state.searchQuery)) return false;
      }

      return true;
    });
  }

  // ── Render: Category Card Grid ──────────────────────────────

  function renderGrid() {
    const filteredItems = getFilteredItems();
    const filteredCategories = [
      ...new Set(filteredItems.map((i) => i.category)),
    ];
    const allCategories = getCategoriesForSection(state.activeSection);

    let html = "";
    let visibleCount = 0;

    allCategories.forEach((cat, index) => {
      const isVisible = filteredCategories.includes(cat);
      if (!isVisible) return;
      visibleCount++;

      const catItems = CHECKLIST_DATA.filter(
        (i) => i.section === state.activeSection && i.category === cat,
      );
      const checkedCount = catItems.filter((i) =>
        Storage.isChecked(i.id),
      ).length;
      const total = catItems.length;
      const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
      const essentialsLeft = catItems.filter(
        (i) => i.priority === "essential" && !Storage.isChecked(i.id),
      ).length;
      const isComplete = pct === 100;
      const icon = CATEGORY_ICONS[cat] || "📦";

      html += `<div class="category-card${isComplete ? " complete" : ""}" data-category="${cat}" style="animation-delay: ${index * 0.05}s">`;
      if (isComplete)
        html += `<div class="card-complete-badge">✓</div>`;
      html += `<div class="card-icon">${icon}</div>`;
      html += `<h3 class="card-name">${cat}</h3>`;
      html += `<p class="card-progress-text">${checkedCount} of ${total} items</p>`;
      html += `<div class="card-progress-track"><div class="card-progress-fill" style="width:${pct}%"></div></div>`;
      html += `<span class="card-percent">${pct}%</span>`;
      if (essentialsLeft > 0) {
        html += `<span class="card-essentials-badge">🔴 ${essentialsLeft} essential${essentialsLeft > 1 ? "s" : ""} left</span>`;
      }
      html += `</div>`;
    });

    dom.categoryGrid.innerHTML = html;
    dom.emptyState.style.display = visibleCount === 0 ? "" : "none";
  }

  // ── Render: Hero Section ────────────────────────────────────

  function renderHero() {
    const sectionItems = CHECKLIST_DATA.filter(
      (i) => i.section === state.activeSection,
    );
    const total = sectionItems.length;
    const done = sectionItems.filter((i) => Storage.isChecked(i.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const essentialsLeft = sectionItems.filter(
      (i) => i.priority === "essential" && !Storage.isChecked(i.id),
    ).length;

    dom.heroPercent.textContent = pct + "%";
    dom.statDone.textContent = done;
    dom.statTotal.textContent = total;
    dom.statEssentials.textContent = essentialsLeft;
    dom.heroSubtext.textContent = `${done} of ${total} items checked off`;
    dom.heroHeading.textContent = getMotivationalHeading(pct);

    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (pct / 100) * circumference;
    dom.heroRingFill.style.strokeDashoffset = offset;
  }

  // ── Render: Drill-Down Drawer ───────────────────────────────

  function renderDrawer() {
    if (!state.drawerCategory) return;

    const cat = state.drawerCategory;
    const items = CHECKLIST_DATA.filter(
      (i) => i.section === state.activeSection && i.category === cat,
    );
    const checkedCount = items.filter((i) => Storage.isChecked(i.id)).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    dom.drawerIcon.textContent = CATEGORY_ICONS[cat] || "📦";
    dom.drawerName.textContent = cat;
    dom.drawerProgressText.textContent = `${checkedCount} / ${total}`;
    dom.drawerProgressFill.style.width = pct + "%";

    const scrollTop = dom.drawerBody.scrollTop;

    let html = "";
    items.forEach((item) => {
      const checked = Storage.isChecked(item.id);
      html += buildDrawerItemHTML(item, checked);
    });

    dom.drawerBody.innerHTML = html;
    dom.drawerBody.scrollTop = scrollTop;
  }

  function buildDrawerItemHTML(item, checked) {
    const checkedClass = checked ? " checked" : "";
    const checkedAttr = checked ? " checked" : "";
    const priorityLabel =
      item.priority === "nice-to-have"
        ? "Nice to Have"
        : item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
    const qtyLabel =
      item.quantity > 1
        ? `<span class="item-qty">×${item.quantity}</span>`
        : "";

    return `
      <div class="drawer-item priority-${item.priority}${checkedClass}" data-id="${item.id}">
        <label class="checkbox-wrapper" onclick="event.stopPropagation()">
          <input type="checkbox"${checkedAttr} data-id="${item.id}">
          <span class="custom-checkbox">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        </label>
        <div class="item-content">
          <div class="item-top-row">
            <span class="item-name">${item.name}</span>
            ${qtyLabel}
            <span class="priority-badge ${item.priority}">${priorityLabel}</span>
          </div>
          <div class="item-description">${item.description}</div>
        </div>
      </div>`;
  }

  // ── Master Render ───────────────────────────────────────────

  function render() {
    renderGrid();
    renderHero();
    renderDrawer();
  }

  // ── Drawer Lifecycle ────────────────────────────────────────

  function openDrawer(category) {
    state.drawerCategory = category;
    renderDrawer();
    requestAnimationFrame(() => {
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
      () => {
        if (!dom.drawer.classList.contains("open")) {
          state.drawerCategory = null;
          dom.drawerBody.innerHTML = "";
        }
      },
      { once: true },
    );
  }

  // ── Event Handlers ──────────────────────────────────────────

  function onCheckboxChange(e) {
    if (
      e.target.tagName === "INPUT" &&
      e.target.type === "checkbox" &&
      e.target.dataset.id
    ) {
      Storage.setChecked(e.target.dataset.id, e.target.checked);
      render();
    }
  }

  function onDrawerItemClick(e) {
    const item = e.target.closest(".drawer-item");
    if (!item) return;
    if (e.target.closest(".checkbox-wrapper")) return;

    const id = item.dataset.id;
    const isChecked = Storage.isChecked(id);
    Storage.setChecked(id, !isChecked);
    render();
  }

  function onCardClick(e) {
    const card = e.target.closest(".category-card");
    if (!card) return;
    const category = card.dataset.category;
    openDrawer(category);
  }

  function onTabClick(e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    const section = tab.dataset.section;
    if (section === state.activeSection) return;

    state.activeSection = section;

    dom.sectionTabs.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.section === section);
    });

    if (state.drawerCategory) closeDrawer();
    render();
  }

  function onPillClick(e) {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    const filter = pill.dataset.filter;

    state.activeFilter = filter;

    dom.filterPills.querySelectorAll(".pill").forEach((p) => {
      p.classList.toggle("active", p.dataset.filter === filter);
    });

    render();
  }

  let searchTimeout;
  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = dom.searchInput.value.toLowerCase().trim();
      render();
    }, 200);
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && state.drawerCategory) {
      closeDrawer();
    }
  }

  // ── Init ────────────────────────────────────────────────────

  function init() {
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

  init();
})();
