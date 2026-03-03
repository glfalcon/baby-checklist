# Baby Checklist — Quantity Editing & Move Items Feature Plan

## Overview
Add two new capabilities to the Baby Checklist app:
1. **Edit quantity** for items with multiple (e.g., "6 bottles" → user can change to 4)
2. **Move items across categories** (e.g., move an item from "Feeding" to "Nursery")

Both features must work seamlessly on mobile (primary use case) and desktop.

---

## Decisions Made
- ✅ **Interaction**: Use existing click/tap → Status Sheet (no new gestures)
- ✅ **Desktop**: Enhance hover state for discoverability (no extra buttons)
- ✅ **Cross-section moves**: NO — keep moves within the same section only
- ✅ **Move confirmation**: YES — show confirm dialog before moving

---

## Phase 1: Edit Item Quantity

### 1.1 Data Layer Changes
**File:** `app.js`

- Add a new storage key pattern for custom quantities: `qty:{itemId}`
- Create helper functions in the `Storage` object:
  ```javascript
  getQuantity(id)     // Returns custom qty or falls back to item.quantity
  setQuantity(id, n)  // Saves to localStorage
  ```
- If Google Sheets sync is active, add a column for custom quantity or extend the existing row format

### 1.2 UI: Inline Quantity Stepper
**File:** `app.js` (in `buildDrawerItemHTML`)

- Replace the static `×N` quantity badge with an **interactive stepper** when quantity > 1
- Stepper format: `[ − ]  4  [ + ]`
- On tap: increment/decrement and save immediately
- Minimum quantity: 1 (cannot go below)
- Only show stepper for items where original quantity > 1 OR user has customized it

### 1.3 Stepper Styling
**File:** `styles.css`

```css
.qty-stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}
.qty-stepper button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-card);
  font-size: 14px;
  cursor: pointer;
}
.qty-stepper button:active {
  transform: scale(0.95);
}
.qty-stepper .qty-value {
  min-width: 20px;
  text-align: center;
  font-weight: 600;
}
```

### 1.4 Mobile & Desktop Considerations
- **Mobile**: Stepper buttons are 44×44px touch targets (via padding)
- **Desktop**: Standard button sizing, hover states added

---

## Phase 2: Move Items Across Categories

### 2.1 Interaction Design — Extend Existing Status Sheet
You already have a unified interaction that works on both mobile and desktop:
- **Mobile**: Tap item → opens Status Sheet
- **Mobile**: Long-press item → opens Status Sheet (backup gesture)
- **Desktop**: Click item → opens Status Sheet

**Approach:** Extend the existing Status Sheet with new options (no new interaction patterns needed):
- **📂 Move to...** → expands to show category sub-options
- **📝 Edit Quantity** → inline stepper (only for items with qty > 1)

This keeps the UX consistent across all devices.

### 2.2 HTML: Extend Status Sheet
**File:** `index.html`

Update the existing `#statusSheet` to include new options:
```html
<!-- Add after existing status options -->
<div class="status-divider"></div>
<button class="status-option" id="moveToOption" onclick="showMoveOptions()">
  <span class="status-option-icon">📂</span>
  <span class="status-option-label">Move to...</span>
  <span class="status-option-arrow">›</span>
</button>

<!-- Move sub-options (hidden by default, shown when "Move to" is tapped) -->
<div class="move-options-container" id="moveOptionsContainer" style="display:none">
  <button class="status-option back-option" onclick="hideMoveOptions()">
    <span class="status-option-icon">‹</span>
    <span class="status-option-label">Back</span>
  </button>
  <div id="moveOptionsList"></div>
</div>

<!-- Move confirmation dialog -->
<div class="move-confirm" id="moveConfirm" style="display:none">
  <p class="move-confirm-text" id="moveConfirmText">Move to Feeding?</p>
  <div class="move-confirm-buttons">
    <button class="move-confirm-cancel" onclick="cancelMove()">Cancel</button>
    <button class="move-confirm-ok" onclick="confirmMove()">Move</button>
  </div>
</div>
```

### 2.3 JavaScript: Move Logic (Integrated into Status Sheet)
**File:** `app.js`

```javascript
var pendingMoveCategory = null;

function showMoveOptions() {
  var item = getItemById(statusSheetItemId);
  if (!item) return;

  // Only show categories from the SAME section
  var categories = getCategoriesForSection(item.section);
  var html = '';

  categories.forEach(function(cat) {
    if (cat === item.category) return; // Skip current category
    var icon = CATEGORY_ICONS[cat] || '📦';
    html += '<button class="status-option move-cat-option" onclick="requestMoveToCategory(\'' + cat + '\')">' +
      '<span class="status-option-icon">' + icon + '</span>' +
      '<span class="status-option-label">' + cat + '</span>' +
    '</button>';
  });

  document.getElementById('moveOptionsList').innerHTML = html;
  document.querySelector('.status-sheet-options').style.display = 'none';
  document.getElementById('moveOptionsContainer').style.display = 'block';
}

function hideMoveOptions() {
  document.getElementById('moveOptionsContainer').style.display = 'none';
  document.getElementById('moveConfirm').style.display = 'none';
  document.querySelector('.status-sheet-options').style.display = 'block';
}

function requestMoveToCategory(newCategory) {
  pendingMoveCategory = newCategory;
  var icon = CATEGORY_ICONS[newCategory] || '📦';
  document.getElementById('moveConfirmText').textContent = 'Move to ' + icon + ' ' + newCategory + '?';
  document.getElementById('moveOptionsContainer').style.display = 'none';
  document.getElementById('moveConfirm').style.display = 'block';
}

function cancelMove() {
  pendingMoveCategory = null;
  hideMoveOptions();
}

function confirmMove() {
  if (!statusSheetItemId || !pendingMoveCategory) return;

  // Store the move override
  var movedItems = JSON.parse(localStorage.getItem('movedItems') || '{}');
  movedItems[statusSheetItemId] = pendingMoveCategory;
  localStorage.setItem('movedItems', JSON.stringify(movedItems));

  // Sync to Google Sheets if online
  saveMoveToSheet(statusSheetItemId, pendingMoveCategory);

  var targetCategory = pendingMoveCategory;
  pendingMoveCategory = null;

  closeStatusSheet();
  render();

  // Open the new category drawer to show where item went
  setTimeout(function() { openDrawer(targetCategory); }, 300);
}
```

### 2.4 Update `openStatusSheet` to Reset Move Options View
**File:** `app.js`

In the existing `openStatusSheet()` function, ensure we reset to the main options view:
```javascript
function openStatusSheet(itemId, itemName) {
  statusSheetItemId = itemId;
  // ... existing code ...

  // Reset to main options (hide move sub-menu and confirm)
  document.getElementById('moveOptionsContainer').style.display = 'none';
  document.getElementById('moveConfirm').style.display = 'none';
  document.querySelector('.status-sheet-options').style.display = 'block';
}
```

### 2.5 Styling: Move Options & Confirm Dialog
**File:** `styles.css`

```css
.status-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}

.status-option-arrow {
  margin-left: auto;
  opacity: 0.5;
  font-size: 18px;
}

.move-options-container {
  max-height: 300px;
  overflow-y: auto;
}

.back-option {
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}

.move-cat-option:hover {
  background: var(--bg-hover);
}

/* Move Confirmation Dialog */
.move-confirm {
  padding: 16px;
  text-align: center;
}

.move-confirm-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.move-confirm-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.move-confirm-cancel,
.move-confirm-ok {
  padding: 10px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.move-confirm-cancel {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.move-confirm-ok {
  background: var(--accent);
  color: white;
}
```

### 2.6 Update `getAllItems()` to Apply Move Overrides
**File:** `app.js`

Modify the function that returns items to respect moved categories:
```javascript
function getAllItems() {
  var movedItems = JSON.parse(localStorage.getItem('movedItems') || '{}');
  var allItems = CHECKLIST_DATA.concat(customItems);

  return allItems.map(function(item) {
    if (movedItems[item.id]) {
      return Object.assign({}, item, { category: movedItems[item.id] });
    }
    return item;
  }).filter(function(item) {
    return !deletedItemIds[item.id];
  });
}
```

### 2.7 Google Sheets Sync for Moves
**File:** `app.js`

Add a new "MovedItems" sheet to track moves:
- Columns: `itemId, newCategory, movedBy, movedAt`
- On sync, apply move overrides to item categories

---

## Phase 3: Polish & Edge Cases

### 3.1 Edge Cases to Handle
- **Moving the last item out of a category**: Category becomes empty → hide from grid
- **Moving an item to a new category**: Only allow moving to existing categories (creating new categories is out of scope)
- **Cross-section moves**: NOT allowed — only show categories from the same section

### 3.2 Accessibility
- Ensure quantity stepper buttons have `aria-label="Decrease quantity"` / `"Increase quantity"`
- Move sheet should trap focus when open
- Announce changes via `aria-live` regions

### 3.3 Animation Polish
- Quantity value change: subtle scale pulse on number
- Move completion: item animates out before re-rendering in new category

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add move options, confirmation dialog to Status Sheet |
| `app.js` | Quantity storage, stepper logic, move logic with confirm, update `getAllItems()`, Google Sheets sync |
| `styles.css` | Quantity stepper styles, move options styles, confirm dialog styles |

---

## Estimated Effort
- **Phase 1 (Quantity)**: ~45 mins
- **Phase 2 (Move Items)**: ~1 hour
- **Phase 3 (Polish)**: ~30 mins

**Total: ~2.5 hours**
