const KEY = "daily-ledger-v1";
const LEGACY_PROFILE_KEY = "daily-ledger-profile-v1";
const LEGACY_AUTH_USERS_KEY = "daily-ledger-users-v1";
const LEGACY_SESSION_KEY = "daily-ledger-session-v1";
const USERS_KEY = "daily-ledger-local-users-v1";
const ACTIVE_USER_KEY = "daily-ledger-active-user-v1";

const expenseCats = ["อาหาร", "เดินทาง", "เรียน/งาน", "บิล", "ช้อปปิ้ง", "สุขภาพ", "ความบันเทิง", "อื่นๆ"];
const incomeCats = ["เงินเดือน", "รับจ้าง", "ขายของ", "เงินโอน", "อื่นๆ"];

const $ = (id) => document.getElementById(id);
const els = {
  app: document.querySelector(".app-shell"),
  userGate: $("userGate"),
  userGateForm: $("userGateForm"),
  gateUsername: $("gateUsernameInput"),
  gateUserList: $("gateUserList"),
  switchUser: $("switchUserButton"),
  form: $("transactionForm"),
  id: $("transactionId"),
  date: $("dateInput"),
  amount: $("amountInput"),
  cat: $("categorySelect"),
  customCat: $("customCategoryInput"),
  note: $("noteInput"),
  submit: $("submitButton"),
  reset: $("resetFormButton"),
  selectedDate: $("selectedDateInput"),
  prev: $("previousDayButton"),
  next: $("nextDayButton"),
  today: $("todayButton"),
  budget: $("dailyBudgetInput"),
  saveBudget: $("saveSettingsButton"),
  dayIncome: $("dayIncome"),
  dayExpense: $("dayExpense"),
  dayNet: $("dayNet"),
  budgetLeft: $("budgetLeft"),
  insight: $("todayInsight"),
  monthLabel: $("monthLabel"),
  chart: $("barChart"),
  catList: $("categoryList"),
  table: $("recordTable"),
  empty: $("emptyState"),
  search: $("searchInput"),
  typeFilter: $("typeFilter"),
  editModal: $("editTransactionModal"),
  editForm: $("editTransactionForm"),
  closeEdit: $("closeEditTransactionButton"),
  cancelEdit: $("cancelEditTransactionButton"),
  editId: $("editTransactionId"),
  editDate: $("editDateInput"),
  editAmount: $("editAmountInput"),
  editCat: $("editCategorySelect"),
  editCustomCat: $("editCustomCategoryInput"),
  editNote: $("editNoteInput"),
  editPreview: $("editTransactionPreview"),
  exportPdf: $("exportPdfButton"),
  exportExcel: $("exportExcelButton"),
  exportJson: $("exportJsonButton"),
  exportCsv: $("exportCsvButton"),
  fileMenu: $("fileMenu"),
  fileMenuButton: $("fileMenuButton"),
  fileMenuPanel: $("fileMenuPanel"),
  importFile: $("importFile"),
  openProfile: $("openProfileButton"),
  profileModal: $("profileModal"),
  closeProfile: $("closeProfileButton"),
  profileForm: $("profileForm"),
  profileStats: $("profileStats"),
  profileAvatar: $("profileAvatar"),
  profileImage: $("profileImageInput"),
  removeProfileImage: $("removeProfileImageButton"),
  profileName: $("profileName"),
  profileEmail: $("profileEmail"),
  deleteProfileModal: $("deleteProfileModal"),
  closeDeleteProfile: $("closeDeleteProfileButton"),
  cancelDeleteProfile: $("cancelDeleteProfileButton"),
  confirmDeleteProfile: $("confirmDeleteProfileButton"),
  deleteProfileAvatar: $("deleteProfileAvatar"),
  deleteProfileName: $("deleteProfileName"),
  deleteProfileMeta: $("deleteProfileMeta"),
  deleteSummaryStats: $("deleteSummaryStats"),
  deleteRecentList: $("deleteRecentList"),
  userAvatarSmall: $("userAvatarSmall"),
  userBadge: $("userBadge"),
  toast: $("toast")
};

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const dayName = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });
const monthName = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

let selectedDate = todayISO();
let activeUserId = localStorage.getItem(ACTIVE_USER_KEY) || "";
let state = emptyLedger();
let profile = null;
let pendingDeleteUser = null;

migrateToLocalUsers();
initApp();

function todayISO() {
  return toISO(new Date());
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function uid() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyLedger() {
  return {
    transactions: [],
    settings: { dailyBudget: 0 },
    categories: { expense: expenseCats, income: incomeCats }
  };
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function readLedger(key) {
  return readJson(key, {});
}

function loadUsers() {
  const users = readJson(USERS_KEY, []);
  if (!Array.isArray(users)) return [];
  return users
    .filter((user) => user && user.id && user.name)
    .map((user) => ({
      id: String(user.id),
      name: cleanName(user.name) || "ผู้ใช้",
      email: String(user.email || "").slice(0, 80),
      avatar: String(user.avatar || ""),
      createdAt: user.createdAt || new Date().toISOString()
    }));
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getActiveUser() {
  return loadUsers().find((user) => user.id === activeUserId) || null;
}

function userLedgerKey(userId = activeUserId) {
  return `${KEY}:local-user:${userId}`;
}

function load() {
  return normalize({ ...emptyLedger(), ...readLedger(userLedgerKey()) });
}

function normalize(data) {
  const cats = {
    expense: [...new Set([...(data.categories?.expense || []), ...expenseCats])],
    income: [...new Set([...(data.categories?.income || []), ...incomeCats])]
  };
  const transactions = (data.transactions || [])
    .map((t) => ({
      id: String(t.id || uid()),
      type: t.type === "income" ? "income" : "expense",
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayISO(),
      amount: Math.max(0, Number(t.amount) || 0),
      category: String(t.category || "อื่นๆ").slice(0, 28),
      note: String(t.note || "").slice(0, 120),
      createdAt: t.createdAt || new Date().toISOString()
    }))
    .filter((t) => t.amount > 0);
  transactions.forEach((t) => addCategory(t.type, t.category, cats));
  return {
    transactions,
    categories: cats,
    settings: { dailyBudget: Math.max(0, Number(data.settings?.dailyBudget) || 0) }
  };
}

function save() {
  if (!activeUserId) return;
  localStorage.setItem(userLedgerKey(), JSON.stringify(state));
}

function saveProfileData() {
  if (!profile) return;
  const users = loadUsers().map((user) => user.id === profile.id ? profile : user);
  saveUsers(users);
}

function migrateToLocalUsers() {
  if (loadUsers().length) return;

  const migrated = [];
  const oldUsers = readJson(LEGACY_AUTH_USERS_KEY, []);
  if (Array.isArray(oldUsers) && oldUsers.length) {
    oldUsers.forEach((oldUser) => {
      const name = cleanName(oldUser.name || oldUser.email || "ผู้ใช้");
      if (!name || migrated.some((user) => normalizeName(user.name) === normalizeName(name))) return;
      const user = {
        id: oldUser.id ? String(oldUser.id) : uid(),
        name,
        email: String(oldUser.email || "").slice(0, 80),
        avatar: String(oldUser.avatar || oldUser.picture || ""),
        createdAt: oldUser.createdAt || new Date().toISOString()
      };
      migrated.push(user);
      const oldLedger = readLedger(`${KEY}:${oldUser.id}`);
      if (oldLedger.transactions?.length) localStorage.setItem(userLedgerKey(user.id), JSON.stringify(normalize(oldLedger)));
    });
  }

  const legacyProfile = readJson(LEGACY_PROFILE_KEY, {});
  const legacyLedger = readLedger(KEY);
  if (legacyLedger.transactions?.length || legacyProfile.name || legacyProfile.email || legacyProfile.avatar) {
    const name = cleanName(legacyProfile.name || "ผู้ใช้เดิม");
    const existing = migrated.find((user) => normalizeName(user.name) === normalizeName(name));
    const user = existing || {
      id: uid(),
      name,
      email: String(legacyProfile.email || "").slice(0, 80),
      avatar: String(legacyProfile.avatar || ""),
      createdAt: new Date().toISOString()
    };
    if (!existing) migrated.push(user);
    if (legacyLedger.transactions?.length && !readLedger(userLedgerKey(user.id)).transactions?.length) {
      localStorage.setItem(userLedgerKey(user.id), JSON.stringify(normalize(legacyLedger)));
    }
  }

  if (!migrated.length) return;
  saveUsers(migrated);
  const legacySessionUser = migrated.find((user) => user.id === sessionStorage.getItem(LEGACY_SESSION_KEY));
  activeUserId = (legacySessionUser || migrated[0]).id;
  localStorage.setItem(ACTIVE_USER_KEY, activeUserId);
}

function initApp() {
  const user = getActiveUser();
  profile = user ? { ...user } : null;
  showGate();
  bindEvents();
  drawIcons();
}

function bindEvents() {
  els.userGateForm.addEventListener("submit", createUserFromGate);
  els.gateUserList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-user-id]");
    if (!button) return;
    const user = loadUsers().find((item) => item.id === button.dataset.userId);
    if (!user) return;
    if (button.dataset.action === "delete") {
      openDeleteProfileModal(user);
    } else {
      enterUser(user);
    }
  });
  els.switchUser.addEventListener("click", showGate);

  els.form.addEventListener("submit", saveTransaction);
  document.querySelectorAll("input[name='type']").forEach((el) => el.addEventListener("change", () => renderCategoryOptions()));
  els.reset.addEventListener("click", resetForm);
  els.selectedDate.addEventListener("change", () => { selectedDate = els.selectedDate.value || todayISO(); render(); });
  els.prev.addEventListener("click", () => { selectedDate = addDays(selectedDate, -1); render(); });
  els.next.addEventListener("click", () => { selectedDate = addDays(selectedDate, 1); render(); });
  els.today.addEventListener("click", () => { selectedDate = todayISO(); render(); });
  els.saveBudget.addEventListener("click", () => {
    state.settings.dailyBudget = Math.max(0, Number(els.budget.value) || 0);
    save();
    render();
    toast("บันทึกงบแล้ว");
  });
  els.search.addEventListener("input", renderTable);
  els.typeFilter.addEventListener("change", renderTable);
  els.table.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    btn.dataset.action === "edit" ? editItem(btn.dataset.id) : deleteItem(btn.dataset.id);
  });
  els.editForm.addEventListener("submit", saveEditedTransaction);
  els.closeEdit.addEventListener("click", closeEditTransactionModal);
  els.cancelEdit.addEventListener("click", closeEditTransactionModal);
  els.editModal.addEventListener("click", (e) => {
    if (e.target === els.editModal) closeEditTransactionModal();
  });
  document.querySelectorAll("input[name='editType']").forEach((el) => el.addEventListener("change", () => {
    renderEditCategoryOptions();
    renderEditPreview();
  }));
  [els.editDate, els.editAmount, els.editCat, els.editCustomCat, els.editNote].forEach((el) => {
    el.addEventListener("input", renderEditPreview);
    el.addEventListener("change", renderEditPreview);
  });
  els.exportJson.addEventListener("click", exportJson);
  els.exportCsv.addEventListener("click", exportCsv);
  els.exportPdf.addEventListener("click", exportPdf);
  els.exportExcel.addEventListener("click", exportExcel);
  els.fileMenuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFileMenu();
  });
  els.fileMenuPanel.addEventListener("click", () => closeFileMenu());
  els.importFile.addEventListener("change", (e) => e.target.files[0] && importJson(e.target.files[0]));
  els.openProfile.addEventListener("click", openProfile);
  els.closeProfile.addEventListener("click", closeProfile);
  els.profileModal.addEventListener("click", (e) => {
    if (e.target === els.profileModal) closeProfile();
  });
  els.profileForm.addEventListener("submit", saveProfile);
  els.profileImage.addEventListener("change", (e) => setProfileImage(e.target.files[0]));
  els.removeProfileImage.addEventListener("click", removeProfileImage);
  els.closeDeleteProfile.addEventListener("click", closeDeleteProfileModal);
  els.cancelDeleteProfile.addEventListener("click", closeDeleteProfileModal);
  els.confirmDeleteProfile.addEventListener("click", confirmDeleteProfile);
  els.deleteProfileModal.addEventListener("click", (e) => {
    if (e.target === els.deleteProfileModal) closeDeleteProfileModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFileMenu();
    if (e.key === "Escape" && !els.editModal.hidden) closeEditTransactionModal();
    if (e.key === "Escape" && !els.deleteProfileModal.hidden) closeDeleteProfileModal();
  });
  document.addEventListener("click", (e) => {
    if (!els.fileMenu.contains(e.target)) closeFileMenu();
  });
}

function toggleFileMenu() {
  const willOpen = els.fileMenuPanel.hidden;
  els.fileMenuPanel.hidden = !willOpen;
  els.fileMenuButton.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) drawIcons();
}

function closeFileMenu() {
  els.fileMenuPanel.hidden = true;
  els.fileMenuButton.setAttribute("aria-expanded", "false");
}

function showGate() {
  closeFileMenu();
  closeEditTransactionModal();
  closeProfile();
  closeDeleteProfileModal();
  els.app.hidden = true;
  els.userGate.hidden = false;
  renderGateUsers();
  els.gateUsername.focus();
  drawIcons();
}

function enterUser(user) {
  activeUserId = user.id;
  localStorage.setItem(ACTIVE_USER_KEY, activeUserId);
  profile = { ...user };
  state = load();
  els.userGate.hidden = true;
  els.app.hidden = false;
  selectedDate = todayISO();
  renderCategoryOptions();
  resetForm();
  render();
  toast(`เข้าใช้งาน: ${profile.name}`);
}

function createUserFromGate(event) {
  event.preventDefault();
  const name = cleanName(els.gateUsername.value);
  if (!name) return alert("กรุณากรอกชื่อผู้ใช้");

  const users = loadUsers();
  if (users.some((user) => normalizeName(user.name) === normalizeName(name))) {
    alert("ชื่อนี้มีอยู่แล้ว กรุณาเลือกจากรายชื่อเดิมด้านล่าง");
    els.gateUsername.select();
    return;
  }

  const user = { id: uid(), name, email: "", avatar: "", createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  localStorage.setItem(userLedgerKey(user.id), JSON.stringify(emptyLedger()));
  els.gateUsername.value = "";
  enterUser(user);
}

function renderGateUsers() {
  const users = loadUsers().sort((a, b) => a.name.localeCompare(b.name, "th"));
  if (!users.length) {
    els.gateUserList.innerHTML = `<div class="gate-empty">ยังไม่มีผู้ใช้ สร้างชื่อแรกเพื่อเริ่มใช้งาน</div>`;
    return;
  }
  els.gateUserList.innerHTML = `
    <div class="gate-users-title">ผู้ใช้เดิม</div>
    ${users.map((user) => `
      ${renderGateUserCard(user)}
    `).join("")}
  `;
  drawIcons();
}

function renderGateUserCard(user) {
  const ledger = normalize({ ...emptyLedger(), ...readLedger(userLedgerKey(user.id)) });
  const latest = ledger.transactions
    .map((transaction) => transaction.date)
    .sort((a, b) => b.localeCompare(a))[0] || "ยังไม่มี";
  const emailText = user.email ? user.email : "ไม่มีอีเมล";

  return `
    <article class="gate-user-card">
      <div class="gate-user-main">
        <span class="avatar avatar-small">${escapeHTML(initials(user.name))}</span>
        <div class="gate-user-copy">
          <strong>${escapeHTML(user.name)}</strong>
          <span>${escapeHTML(emailText)} | ล่าสุด ${escapeHTML(latest)}</span>
        </div>
      </div>
      <div class="gate-user-actions">
        <button class="gate-user-button" type="button" data-action="enter" data-user-id="${escapeHTML(user.id)}">
          <i data-lucide="log-in"></i>
          เข้าใช้งาน
        </button>
        <button class="gate-delete-button" type="button" data-action="delete" data-user-id="${escapeHTML(user.id)}" title="ลบโปรไฟล์ ${escapeHTML(user.name)}" aria-label="ลบโปรไฟล์ ${escapeHTML(user.name)}">
          <i data-lucide="trash-2"></i>
          ลบโปรไฟล์
        </button>
      </div>
    </article>
  `;
}

function getDeleteProfileDetails(user) {
  const ledger = normalize({ ...emptyLedger(), ...readLedger(userLedgerKey(user.id)) });
  const summary = sums(ledger.transactions);
  const recent = ledger.transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  return { ledger, summary, recent };
}

function openDeleteProfileModal(user) {
  pendingDeleteUser = user;
  const { ledger, summary, recent } = getDeleteProfileDetails(user);
  renderStaticAvatar(els.deleteProfileAvatar, user, "large");
  els.deleteProfileName.textContent = user.name;
  els.deleteProfileMeta.textContent = `${user.email || "ไม่มีอีเมล"} | ${user.avatar ? "มีรูปโปรไฟล์" : "ไม่มีรูปโปรไฟล์"}`;
  els.deleteSummaryStats.innerHTML = `
    <div class="delete-summary-card"><span>ประวัติ</span><strong>${ledger.transactions.length}</strong><small>รายการ</small></div>
    <div class="delete-summary-card income"><span>รายรับรวม</span><strong>${money.format(summary.income)}</strong><small>ทั้งหมด</small></div>
    <div class="delete-summary-card expense"><span>รายจ่ายรวม</span><strong>${money.format(summary.expense)}</strong><small>ทั้งหมด</small></div>
    <div class="delete-summary-card balance"><span>คงเหลือรวม</span><strong>${money.format(summary.net)}</strong><small>สุทธิ</small></div>
  `;
  els.deleteRecentList.innerHTML = recent.length
    ? recent.map(renderDeleteRecentItem).join("")
    : `<div class="delete-empty">ยังไม่มีประวัติรายรับรายจ่ายในโปรไฟล์นี้</div>`;
  els.deleteProfileModal.hidden = false;
  els.cancelDeleteProfile.focus();
  drawIcons();
}

function renderStaticAvatar(target, user, size = "small") {
  target.innerHTML = "";
  if (user.avatar) {
    const img = document.createElement("img");
    img.src = user.avatar;
    img.alt = user.name || "profile";
    target.appendChild(img);
    return;
  }
  target.textContent = initials(user.name || user.email, size === "large" ? 2 : 1);
}

function renderDeleteRecentItem(transaction) {
  const isIncome = transaction.type === "income";
  const note = String(transaction.note || "").replace(/\s+/g, " ").trim();
  return `
    <div class="delete-history-item ${isIncome ? "income" : "expense"}">
      <div>
        <span>${escapeHTML(transaction.date)} | ${isIncome ? "รายรับ" : "รายจ่าย"}</span>
        <strong>${escapeHTML(transaction.category)}${note ? ` (${escapeHTML(note)})` : ""}</strong>
      </div>
      <b>${isIncome ? "+" : "-"}${money.format(transaction.amount)}</b>
    </div>
  `;
}

function closeDeleteProfileModal() {
  pendingDeleteUser = null;
  els.deleteProfileModal.hidden = true;
}

function confirmDeleteProfile() {
  if (!pendingDeleteUser) return closeDeleteProfileModal();
  const user = pendingDeleteUser;

  saveUsers(loadUsers().filter((item) => item.id !== user.id));
  localStorage.removeItem(userLedgerKey(user.id));
  if (activeUserId === user.id) {
    activeUserId = "";
    profile = null;
    state = emptyLedger();
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
  closeDeleteProfileModal();
  renderGateUsers();
  toast(`ลบโปรไฟล์ ${user.name} แล้ว`);
}

function renderUserIdentity() {
  if (!profile) return;
  els.userBadge.textContent = profile.name || profile.email || "โปรไฟล์";
  renderAvatar(els.userAvatarSmall, "small");
  renderAvatar(els.profileAvatar, "large");
}

function renderAvatar(target, size = "small") {
  if (!target || !profile) return;
  target.innerHTML = "";
  if (profile.avatar) {
    const img = document.createElement("img");
    img.src = profile.avatar;
    img.alt = profile.name || "profile";
    target.appendChild(img);
    return;
  }
  target.textContent = initials(profile.name || profile.email, size === "large" ? 2 : 1);
}

function initials(text, length = 1) {
  const clean = String(text || "U").trim();
  const parts = clean.includes("@") ? [clean[0]] : clean.split(/\s+/);
  return parts.map((part) => part[0]).join("").slice(0, length).toUpperCase() || "U";
}

function openProfile() {
  if (!profile) return showGate();
  els.profileName.value = profile.name || "";
  els.profileEmail.value = profile.email || "";
  renderUserIdentity();
  renderProfileStats();
  els.profileModal.hidden = false;
  drawIcons();
}

function closeProfile() {
  els.profileModal.hidden = true;
}

function saveProfile(event) {
  event.preventDefault();
  const nextName = cleanName(els.profileName.value) || "ผู้ใช้";
  const duplicated = loadUsers().some((user) => user.id !== activeUserId && normalizeName(user.name) === normalizeName(nextName));
  if (duplicated) {
    alert("ชื่อนี้มีผู้ใช้อื่นใช้แล้ว กรุณาเปลี่ยนชื่อ");
    els.profileName.select();
    return;
  }

  profile = {
    ...profile,
    name: nextName,
    email: els.profileEmail.value.trim().slice(0, 80)
  };
  saveProfileData();
  renderUserIdentity();
  renderProfileStats();
  closeProfile();
  toast("บันทึกโปรไฟล์แล้ว");
}

function renderProfileStats() {
  els.profileStats.innerHTML = `
    <div class="profile-stat"><span>ผู้ใช้</span><strong>${escapeHTML(profile?.name || "-")}</strong></div>
    <div class="profile-stat"><span>จำนวนรายการ</span><strong>${state.transactions.length}</strong></div>
    <div class="profile-stat"><span>ข้อมูล</span><strong>แยกตามชื่อผู้ใช้</strong></div>
  `;
}

function removeProfileImage() {
  if (!profile) return;
  profile.avatar = "";
  saveProfileData();
  renderUserIdentity();
  toast("ลบรูปโปรไฟล์แล้ว");
}

function setProfileImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return alert("กรุณาเลือกรูปภาพ");
  const reader = new FileReader();
  reader.onload = () => resizeProfileImage(String(reader.result));
  reader.readAsDataURL(file);
}

function resizeProfileImage(src) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const size = 240;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(size / img.width, size / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
    profile.avatar = canvas.toDataURL("image/jpeg", 0.82);
    saveProfileData();
    renderUserIdentity();
    toast("อัปเดตรูปโปรไฟล์แล้ว");
  };
  img.src = src;
}

function currentType() {
  return document.querySelector("input[name='type']:checked").value;
}

function currentEditType() {
  return document.querySelector("input[name='editType']:checked").value;
}

function setType(type) {
  document.querySelector(`input[name='type'][value='${type}']`).checked = true;
  renderCategoryOptions();
}

function setEditType(type) {
  document.querySelector(`input[name='editType'][value='${type}']`).checked = true;
  renderEditCategoryOptions();
}

function addCategory(type, name, cats = state.categories) {
  const clean = String(name || "").trim();
  if (clean && !cats[type].includes(clean)) cats[type].push(clean);
}

function renderCategoryOptions(value = "") {
  const type = currentType();
  els.cat.innerHTML = state.categories[type].map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (value && state.categories[type].includes(value)) els.cat.value = value;
}

function renderEditCategoryOptions(value = "") {
  const type = currentEditType();
  const selected = value || els.editCat.value;
  els.editCat.innerHTML = state.categories[type].map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (selected && state.categories[type].includes(selected)) els.editCat.value = selected;
}

function resetForm() {
  els.form.reset();
  els.id.value = "";
  els.date.value = selectedDate;
  setType("expense");
  els.submit.innerHTML = `<i data-lucide="plus"></i> เพิ่มรายการ`;
  drawIcons();
}

function sums(list) {
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}

function render() {
  if (!profile) return showGate();
  els.selectedDate.value = selectedDate;
  if (!els.id.value) els.date.value = selectedDate;
  els.budget.value = state.settings.dailyBudget || "";

  const day = state.transactions.filter((t) => t.date === selectedDate);
  const month = selectedDate.slice(0, 7);
  const monthTx = state.transactions.filter((t) => t.date.startsWith(month));
  const daySum = sums(day);
  const monthSum = sums(monthTx);
  const budgetLeft = state.settings.dailyBudget ? state.settings.dailyBudget - daySum.expense : 0;

  els.dayIncome.textContent = money.format(daySum.income);
  els.dayExpense.textContent = money.format(daySum.expense);
  els.dayNet.textContent = money.format(daySum.net);
  els.budgetLeft.textContent = state.settings.dailyBudget ? money.format(budgetLeft) : "ยังไม่ตั้ง";
  els.insight.textContent = getInsight(daySum, budgetLeft);
  els.monthLabel.textContent = `${monthName.format(fromISO(selectedDate))} | รับ ${money.format(monthSum.income)} จ่าย ${money.format(monthSum.expense)}`;

  renderChart();
  renderCategories(monthTx);
  renderTable();
  renderUserIdentity();
  drawIcons();
}

function renderChart() {
  const days = Array.from({ length: 14 }, (_, i) => addDays(selectedDate, i - 13));
  const rows = days.map((date) => ({ date, ...sums(state.transactions.filter((t) => t.date === date)) }));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  els.chart.innerHTML = rows.map((r) => {
    const h = Math.max(4, Math.round((Math.abs(r.net) / max) * 100));
    const cls = r.net > 0 ? "positive" : r.net === 0 ? "neutral" : "";
    const title = `${r.date} | รับ ${money.format(r.income)} | จ่าย ${money.format(r.expense)} | สุทธิ ${money.format(r.net)}`;
    return `<div class="bar-day" title="${title}">
      <div class="bar-track"><span class="bar-fill ${cls}" style="height:${h}%"></span></div>
      <span class="bar-label">${dayName.format(fromISO(r.date))}</span>
    </div>`;
  }).join("");
}

function getInsight(daySum, budgetLeft) {
  if (!state.settings.dailyBudget) return "ยังไม่ได้ตั้งงบรายวัน ลองตั้งเพื่อประหยัดเงิน";
  if (daySum.expense === 0 && daySum.income === 0) return "วันนี้ยังไม่มีรายการ บันทึกครั้งแรกแล้วภาพรวมจะชัดขึ้น";
  if (budgetLeft < 0) return `วันนี้เกินงบ ${money.format(Math.abs(budgetLeft))} ลองเช็กหมวดที่ใช้เยอะที่สุด`;
  if (budgetLeft <= state.settings.dailyBudget * 0.2) return `งบใกล้หมด เหลือ ${money.format(budgetLeft)} สำหรับวันนี้`;
  if (daySum.net > 0) return `วันนี้ยังเป็นบวก ${money.format(daySum.net)} จังหวะดีสำหรับเก็บออม`;
  return `ยังอยู่ในงบ เหลือใช้ได้อีก ${money.format(budgetLeft)}`;
}

function renderCategories(monthTx) {
  const expenses = monthTx.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  if (!total) {
    els.catList.innerHTML = `<div class="mini-empty">ยังไม่มีรายจ่ายเดือนนี้</div>`;
    return;
  }
  const byCat = Object.entries(expenses.reduce((a, t) => {
    a[t.category] = (a[t.category] || 0) + t.amount;
    return a;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.catList.innerHTML = byCat.map(([name, amount]) => {
    const pct = Math.round((amount / total) * 100);
    return `<div class="category-row">
      <div class="category-line"><span>${escapeHTML(name)}</span><strong>${money.format(amount)}</strong></div>
      <div class="category-meter"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join("");
}

function getFilteredTransactions() {
  const q = els.search.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  return state.transactions
    .filter((t) => type === "all" || t.type === type)
    .filter((t) => !q || `${t.date} ${t.category} ${t.note}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function renderTable() {
  const rows = getFilteredTransactions();
  els.table.innerHTML = rows.map((t) => `
    <tr>
      <td>${t.date}</td>
      <td><span class="type-pill ${t.type}">${t.type === "income" ? "รายรับ" : "รายจ่าย"}</span></td>
      <td>${escapeHTML(t.category)}</td>
      <td class="note-cell">${escapeHTML(t.note || "-")}</td>
      <td class="number-cell amount-${t.type}">${t.type === "income" ? "+" : "-"}${money.format(t.amount)}</td>
      <td class="action-cell">
        <span class="row-actions">
          <button class="icon-button edit" data-action="edit" data-id="${escapeHTML(t.id)}" title="แก้ไข" aria-label="แก้ไข"><i data-lucide="pencil"></i></button>
          <button class="icon-button danger" data-action="delete" data-id="${escapeHTML(t.id)}" title="ลบ" aria-label="ลบ"><i data-lucide="trash-2"></i></button>
        </span>
      </td>
    </tr>`).join("");
  els.empty.classList.toggle("show", rows.length === 0);
  els.table.closest("table").style.display = rows.length ? "table" : "none";
}

function editItem(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return;
  addCategory(t.type, t.category);
  els.editId.value = t.id;
  setEditType(t.type);
  renderEditCategoryOptions(t.category);
  els.editDate.value = t.date;
  els.editAmount.value = t.amount;
  els.editCustomCat.value = "";
  els.editNote.value = t.note;
  renderEditPreview();
  els.editModal.hidden = false;
  setTimeout(() => els.editAmount.focus(), 0);
  drawIcons();
}

function renderEditPreview() {
  const type = currentEditType();
  const isIncome = type === "income";
  const amount = Number(els.editAmount.value) || 0;
  const category = (els.editCustomCat.value.trim() || els.editCat.value || "ยังไม่เลือกหมวดหมู่").slice(0, 28);
  const date = els.editDate.value || "ยังไม่เลือกวันที่";
  const note = els.editNote.value.trim();
  els.editPreview.className = `edit-preview ${isIncome ? "income" : "expense"}`;
  els.editPreview.innerHTML = `
    <div class="edit-preview-icon">
      <i data-lucide="${isIncome ? "trending-up" : "trending-down"}"></i>
    </div>
    <div>
      <span>${date} | ${isIncome ? "รายรับ" : "รายจ่าย"}</span>
      <strong>${isIncome ? "+" : "-"}${money.format(amount)} · ${escapeHTML(category)}</strong>
      <small>${escapeHTML(note || "ไม่มีหมายเหตุ")}</small>
    </div>
  `;
  drawIcons();
}

function closeEditTransactionModal() {
  els.editModal.hidden = true;
  els.editForm.reset();
  els.editId.value = "";
}

function saveEditedTransaction(event) {
  event.preventDefault();
  const id = els.editId.value;
  const idx = state.transactions.findIndex((t) => t.id === id);
  if (idx < 0) return closeEditTransactionModal();

  const type = currentEditType();
  const amount = Number(els.editAmount.value);
  const category = (els.editCustomCat.value.trim() || els.editCat.value).slice(0, 28);
  if (!amount || amount <= 0) return alert("กรุณาใส่จำนวนเงิน");

  addCategory(type, category);
  const original = state.transactions[idx];
  const item = {
    ...original,
    type,
    date: els.editDate.value || todayISO(),
    amount,
    category,
    note: els.editNote.value.trim().slice(0, 120)
  };

  state.transactions[idx] = item;
  selectedDate = item.date;
  save();
  if (currentType() === type) renderCategoryOptions(category);
  closeEditTransactionModal();
  render();
  toast("แก้ไขรายการแล้ว");
}

function deleteItem(id) {
  if (!confirm("ลบรายการนี้?")) return;
  state.transactions = state.transactions.filter((t) => t.id !== id);
  save();
  render();
  toast("ลบแล้ว");
}

function saveTransaction(e) {
  e.preventDefault();
  if (!profile) return showGate();
  const type = currentType();
  const amount = Number(els.amount.value);
  const category = (els.customCat.value.trim() || els.cat.value).slice(0, 28);
  if (!amount || amount <= 0) return alert("กรุณาใส่จำนวนเงิน");
  addCategory(type, category);
  const item = {
    id: els.id.value || uid(),
    type,
    date: els.date.value || todayISO(),
    amount,
    category,
    note: els.note.value.trim().slice(0, 120),
    createdAt: state.transactions.find((t) => t.id === els.id.value)?.createdAt || new Date().toISOString()
  };
  const idx = state.transactions.findIndex((t) => t.id === item.id);
  if (idx >= 0) state.transactions[idx] = item;
  else state.transactions.push(item);
  selectedDate = item.date;
  save();
  renderCategoryOptions(category);
  resetForm();
  render();
  toast(idx >= 0 ? "อัปเดตแล้ว" : "บันทึกแล้ว");
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportJson() {
  download(`ledger-backup-${profile.name}-${todayISO()}.json`, JSON.stringify({ ...state, profile, exportedAt: new Date().toISOString() }, null, 2), "application/json");
}

function exportCsv() {
  const header = ["date", "type", "category", "note", "amount"];
  const rows = state.transactions.map((t) => [t.date, t.type, t.category, t.note, t.amount].map(csv).join(","));
  download(`ledger-${profile.name}-${todayISO()}.csv`, "\ufeff" + [header.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportExcel() {
  const rows = getFilteredTransactions();
  const body = rows.map((t) => `
    <tr>
      <td>${t.date}</td>
      <td>${t.type === "income" ? "รายรับ" : "รายจ่าย"}</td>
      <td>${escapeHTML(t.category)}</td>
      <td>${escapeHTML(t.note || "")}</td>
      <td>${t.amount}</td>
    </tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <h3>บัญชีรายวัน - ${escapeHTML(profile.name)}</h3>
    <table border="1">
      <thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>หมายเหตุ</th><th>จำนวนเงิน</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body></html>`;
  download(`ledger-table-${profile.name}-${todayISO()}.xls`, "\ufeff" + html, "application/vnd.ms-excel;charset=utf-8");
  toast("ส่งออก Excel แล้ว");
}

function exportPdf() {
  toast("เลือก Save as PDF ในหน้าต่างพิมพ์");
  setTimeout(() => window.print(), 150);
}

async function importJson(file) {
  try {
    const incoming = JSON.parse(await file.text());
    const normalized = normalize(incoming);
    const ids = new Set(state.transactions.map((t) => t.id));
    state.transactions.push(...normalized.transactions.filter((t) => !ids.has(t.id)));
    state.categories.expense = [...new Set([...state.categories.expense, ...normalized.categories.expense])];
    state.categories.income = [...new Set([...state.categories.income, ...normalized.categories.income])];
    if (!state.settings.dailyBudget) state.settings.dailyBudget = normalized.settings.dailyBudget;
    if (incoming.profile) {
      profile = {
        ...profile,
        email: String(incoming.profile.email || profile.email || "").slice(0, 80),
        avatar: String(incoming.profile.avatar || profile.avatar || "")
      };
      saveProfileData();
    }
    save();
    renderCategoryOptions();
    render();
    toast("นำเข้าข้อมูลแล้ว");
  } catch {
    alert("ไฟล์นำเข้าไม่ถูกต้อง");
  }
}

function csv(v) {
  return `"${String(v ?? "").replaceAll('"', '""')}"`;
}

function escapeHTML(v) {
  return String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

let toastTimer;
function toast(text) {
  clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function drawIcons() {
  window.lucide?.createIcons();
}
