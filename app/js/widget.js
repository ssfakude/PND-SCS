/**
 * Passenger Status Manager Widget
 * Zoho CRM Widget SDK v2.0
 *
 * CONFIGURATION — edit these to match your CRM setup:
 */
const CONFIG = {
  // The API name of the Subform field on Sales Orders
  SUBFORM_API_NAME: "Passenger_Details",

  // API names of fields INSIDE the subform
  FIELDS: {
    CONTACT_LOOKUP: "Passenger",        // Lookup field to Contacts module
    PAID:           "Paid",             // Checkbox
    DOCS_UPLOADED:  "Documents_Uploaded", // Checkbox
    VISA_OK:        "Visa_Approved",    // Checkbox
    CONFIRMED:      "Confirmed",        // Checkbox
    NOTES:          "Notes",            // Single-line text (optional)
  },

  // How many Sales Orders to return in search
  SEARCH_PAGE_SIZE: 10,
};

/* ─── State ─── */
let currentOrderId   = null;
let currentOrderName = "";
let passengers       = [];   // [{rowId, contactId, contactName, paid, docs, visa, confirmed, notes, _dirty}]
let isSaving         = false;

/* ─── DOM refs ─── */
const screenSearch     = document.getElementById("screen-search");
const screenPassengers = document.getElementById("screen-passengers");
const soSearchInput    = document.getElementById("so-search-input");
const soIdInput        = document.getElementById("so-id-input");
const searchResults    = document.getElementById("search-results");
const searchStatus     = document.getElementById("search-status");
const orderNameDisplay = document.getElementById("order-name-display");
const passengerTbody   = document.getElementById("passenger-tbody");
const passengerTable   = document.getElementById("passenger-table");
const loadingState     = document.getElementById("loading-passengers");
const emptyState       = document.getElementById("empty-state");
const saveStatus       = document.getElementById("save-status");
const passengerCount   = document.getElementById("passenger-count");

/* ─── Init ─── */
ZOHO.embeddedApp.on("PageLoad", function(data) {
  ZOHO.embeddedApp.init().then(() => {
    setupEventListeners();
  });
});

function setupEventListeners() {
  document.getElementById("btn-search").addEventListener("click", handleSearch);
  document.getElementById("btn-load-id").addEventListener("click", handleLoadById);
  document.getElementById("btn-back").addEventListener("click", goBack);
  document.getElementById("btn-save-all").addEventListener("click", saveAllChanges);
  document.getElementById("btn-toggle-all-paid").addEventListener("click", toggleAllPaid);

  soSearchInput.addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });
  soIdInput.addEventListener("keydown", e => { if (e.key === "Enter") handleLoadById(); });

  soSearchInput.addEventListener("input", () => {
    if (!soSearchInput.value.trim()) {
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
    }
  });
}

/* ─── Search Sales Orders ─── */
async function handleSearch() {
  const query = soSearchInput.value.trim();
  if (!query) return;

  searchStatus.textContent = "Searching…";
  searchStatus.className = "status-msg";
  searchResults.classList.add("hidden");
  searchResults.innerHTML = "";

  try {
    const resp = await ZOHO.CRM.API.searchRecord({
      Entity: "Sales_Orders",
      Type: "word",
      Query: query,
      page: 1,
      per_page: CONFIG.SEARCH_PAGE_SIZE,
    });

    if (resp.data && resp.data.length > 0) {
      searchStatus.textContent = `${resp.data.length} result(s) found`;
      renderSearchResults(resp.data);
    } else {
      searchStatus.textContent = "No Sales Orders found.";
    }
  } catch (err) {
    searchStatus.textContent = "Search failed. Check CRM connection.";
    searchStatus.className = "status-msg error";
    console.error("Search error:", err);
  }
}

function renderSearchResults(orders) {
  searchResults.innerHTML = "";
  orders.forEach(order => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <span class="result-name">${escHtml(order.Subject || order.id)}</span>
      <span class="result-meta">ID: ${order.id}${order.Account_Name ? " · " + escHtml(order.Account_Name.name || "") : ""}</span>
    `;
    item.addEventListener("click", () => loadSalesOrder(order.id, order.Subject || order.id));
    searchResults.appendChild(item);
  });
  searchResults.classList.remove("hidden");
}

/* ─── Load by direct ID ─── */
async function handleLoadById() {
  const id = soIdInput.value.trim();
  if (!id) return;
  await loadSalesOrder(id, id);
}

/* ─── Load Sales Order & subform ─── */
async function loadSalesOrder(orderId, orderName) {
  // Switch screens
  showScreen("passengers");
  orderNameDisplay.textContent = "Loading…";
  loadingState.style.display = "flex";
  passengerTable.style.display = "none";
  emptyState.classList.add("hidden");
  passengerTbody.innerHTML = "";
  passengers = [];

  currentOrderId   = orderId;
  currentOrderName = orderName;

  try {
    // Fetch the Sales Order with its subform
    const resp = await ZOHO.CRM.API.getRecord({
      Entity: "Sales_Orders",
      RecordID: orderId,
    });

    if (!resp.data || resp.data.length === 0) {
      throw new Error("Record not found");
    }

    const record = resp.data[0];
    orderNameDisplay.textContent = record.Subject || orderId;
    currentOrderName = record.Subject || orderId;

    const subformRows = record[CONFIG.SUBFORM_API_NAME] || [];

    if (subformRows.length === 0) {
      loadingState.style.display = "none";
      emptyState.classList.remove("hidden");
      passengerCount.textContent = "0 passengers";
      return;
    }

    // Map subform rows to our state
    passengers = subformRows.map(row => ({
      rowId:       row.id,
      contactId:   row[CONFIG.FIELDS.CONTACT_LOOKUP]?.id   || "",
      contactName: row[CONFIG.FIELDS.CONTACT_LOOKUP]?.name || "(Unknown)",
      paid:        !!row[CONFIG.FIELDS.PAID],
      docs:        !!row[CONFIG.FIELDS.DOCS_UPLOADED],
      visa:        !!row[CONFIG.FIELDS.VISA_OK],
      confirmed:   !!row[CONFIG.FIELDS.CONFIRMED],
      notes:       row[CONFIG.FIELDS.NOTES] || "",
      _dirty:      false,
    }));

    renderPassengerTable();
    passengerCount.textContent = `${passengers.length} passenger${passengers.length !== 1 ? "s" : ""}`;

  } catch (err) {
    loadingState.style.display = "none";
    emptyState.classList.remove("hidden");
    emptyState.textContent = "Error loading record: " + (err.message || err);
    console.error("Load error:", err);
  }
}

/* ─── Render table ─── */
function renderPassengerTable() {
  loadingState.style.display = "none";
  passengerTable.style.display = "table";
  passengerTbody.innerHTML = "";

  passengers.forEach((p, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;

    tr.innerHTML = `
      <td>
        <div class="passenger-name">${escHtml(p.contactName)}</div>
        ${p.contactId ? `<div class="passenger-id">${p.contactId}</div>` : ""}
      </td>
      <td class="col-check">
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle paid-toggle"
            data-idx="${idx}" data-field="paid"
            ${p.paid ? "checked" : ""} />
        </div>
      </td>
      <td class="col-check">
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle docs-toggle"
            data-idx="${idx}" data-field="docs"
            ${p.docs ? "checked" : ""} />
        </div>
      </td>
      <td class="col-check">
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle visa-toggle"
            data-idx="${idx}" data-field="visa"
            ${p.visa ? "checked" : ""} />
        </div>
      </td>
      <td class="col-check">
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle conf-toggle"
            data-idx="${idx}" data-field="confirmed"
            ${p.confirmed ? "checked" : ""} />
        </div>
      </td>
      <td>
        <input type="text" class="notes-input"
          data-idx="${idx}"
          placeholder="Add note…"
          value="${escHtml(p.notes)}" />
      </td>
    `;

    passengerTbody.appendChild(tr);
  });

  // Attach change listeners
  passengerTbody.querySelectorAll(".toggle").forEach(toggle => {
    toggle.addEventListener("change", onToggleChange);
  });
  passengerTbody.querySelectorAll(".notes-input").forEach(input => {
    input.addEventListener("input", onNotesChange);
  });
}

/* ─── Toggle change ─── */
function onToggleChange(e) {
  const idx   = parseInt(e.target.dataset.idx);
  const field = e.target.dataset.field;
  passengers[idx][field] = e.target.checked;
  passengers[idx]._dirty = true;
  markRowDirty(idx);
  setSaveStatus("");
}

function onNotesChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  passengers[idx].notes  = e.target.value;
  passengers[idx]._dirty = true;
  markRowDirty(idx);
  setSaveStatus("");
}

function markRowDirty(idx) {
  const tr = passengerTbody.querySelector(`tr[data-idx="${idx}"]`);
  if (tr) tr.classList.add("modified");
}

/* ─── Toggle all paid ─── */
function toggleAllPaid() {
  const allPaid = passengers.every(p => p.paid);
  passengers.forEach((p, idx) => {
    p.paid   = !allPaid;
    p._dirty = true;
    const toggle = passengerTbody.querySelector(`.toggle[data-idx="${idx}"][data-field="paid"]`);
    if (toggle) toggle.checked = !allPaid;
    markRowDirty(idx);
  });
  setSaveStatus("");
}

/* ─── Save all dirty rows ─── */
async function saveAllChanges() {
  if (isSaving) return;

  const dirtyPassengers = passengers.filter(p => p._dirty);
  if (dirtyPassengers.length === 0) {
    setSaveStatus("No changes to save.");
    return;
  }

  isSaving = true;
  const btn = document.getElementById("btn-save-all");
  btn.disabled = true;
  btn.textContent = "Saving…";
  setSaveStatus("");

  try {
    // Build the full subform array (Zoho requires all rows when updating subform)
    const subformData = passengers.map(p => {
      const row = { id: p.rowId };
      row[CONFIG.FIELDS.PAID]          = p.paid;
      row[CONFIG.FIELDS.DOCS_UPLOADED] = p.docs;
      row[CONFIG.FIELDS.VISA_OK]       = p.visa;
      row[CONFIG.FIELDS.CONFIRMED]     = p.confirmed;
      row[CONFIG.FIELDS.NOTES]         = p.notes;
      return row;
    });

    const updatePayload = {
      id: currentOrderId,
      [CONFIG.SUBFORM_API_NAME]: subformData,
    };

    const result = await ZOHO.CRM.API.updateRecord({
      Entity: "Sales_Orders",
      APIData: updatePayload,
    });

    if (result.data && result.data[0]?.code === "SUCCESS") {
      // Clear dirty flags
      passengers.forEach(p => { p._dirty = false; });
      passengerTbody.querySelectorAll("tr.modified").forEach(tr => tr.classList.remove("modified"));
      setSaveStatus(`✓ Saved ${dirtyPassengers.length} update${dirtyPassengers.length > 1 ? "s" : ""}`);
    } else {
      const msg = result.data?.[0]?.message || "Unknown error";
      setSaveStatus(`✗ Save failed: ${msg}`);
      console.error("Save result:", result);
    }

  } catch (err) {
    setSaveStatus("✗ Save error");
    console.error("Save error:", err);
  } finally {
    isSaving = false;
    btn.disabled = false;
    btn.textContent = "Save All Changes";
  }
}

/* ─── Navigation ─── */
function showScreen(name) {
  screenSearch.classList.remove("active");
  screenPassengers.classList.remove("active");
  if (name === "search")     screenSearch.classList.add("active");
  if (name === "passengers") screenPassengers.classList.add("active");
}

function goBack() {
  if (passengers.some(p => p._dirty)) {
    if (!confirm("You have unsaved changes. Go back anyway?")) return;
  }
  showScreen("search");
  searchResults.classList.add("hidden");
  searchResults.innerHTML = "";
  searchStatus.textContent = "";
}

/* ─── Helpers ─── */
function setSaveStatus(msg) {
  saveStatus.textContent = msg;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
