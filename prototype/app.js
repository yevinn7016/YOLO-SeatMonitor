"use strict";

const STORAGE_KEY = "library-seat-prototype-v2";
const SESSION_KEY = "library-seat-prototype-auth";
const VIEWBOX = { width: 1000, height: 562.5 };
const PLAN_VIEWBOX = { width: 1000, height: 600 };
const TABLE_GRID = { cellWidth: 80, cellHeight: 54, paddingX: 40, paddingY: 70, maxColumns: 10, maxRows: 8 };
const NATURAL_COLLATOR = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

const STATUS = {
  empty: { label: "비어 있음", color: "#cbd2da", stroke: "#9aa5b1" },
  occupied: { label: "점유 중", color: "#10ad77", stroke: "#07845a" },
  away: { label: "자리 비움", color: "#f2a21b", stroke: "#b66d00" },
  noshow: { label: "노쇼", color: "#ef4545", stroke: "#c92d36" },
};

const STATUS_ORDER = ["empty", "occupied", "away", "noshow"];

const ROI_CLASS_PRESETS = {
  library: [0, 24, 26, 28, 39, 41, 56, 63, 67, 73],
  person: [0],
  all: Array.from({ length: 80 }, (_, index) => index),
};

const ROI_CLASS_NOTES = {
  library: "사람, 가방류, 책, 노트북, 휴대전화, 병, 컵, 의자",
  person: "사람(person) 클래스만 탐지",
  all: "COCO 데이터셋의 전체 80개 클래스를 탐지",
};

const ICONS = {
  library: '<path d="M4 19.5V5.8c0-.7.5-1.3 1.2-1.4l5.4-.9c.9-.1 1.7.5 1.7 1.4v14.6"/><path d="M12.3 5.1l5.8-.9c.9-.1 1.7.5 1.7 1.4v13.9"/><path d="M2.8 20.5h18.4"/><path d="M7.2 7.2v9.8M15.6 6.9v10.2"/>',
  user: '<circle cx="12" cy="7.6" r="3.1"/><path d="M5.6 20c.6-4 2.7-6.1 6.4-6.1s5.8 2.1 6.4 6.1"/>',
  key: '<circle cx="8" cy="12" r="3.4"/><path d="M11.4 12H21M17 12v3M14 12v2"/>',
  login: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l4-4-4-4M14 12H3"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M14 8l4 4-4 4M18 12H8"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10.5 21l1-6-3-2.5 2.5-5 4 2 2.5 4M13.5 15l4 5M8.5 12.5L5 16"/>',
  warning: '<path d="M10.3 4.2L2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M19 12a7.5 7.5 0 1 1-2-5.1L20 9"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/>',
  map: '<path d="M3 6.5l5-2 8 2 5-2v13l-5 2-8-2-5 2z"/><path d="M8 4.5v13M16 6.5v13"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  camera: '<path d="M14.5 6l-1.2-2H8.7L7.5 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/><circle cx="11" cy="12.5" r="4"/>',
  capture: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="8.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5z"/>',
  save: '<path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V4M7 21v-8h10v8"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
};

function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
}

function makeRect(x1, y1, x2, y2) {
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function defaultSeatIdentity(index) {
  const tableNumber = Math.floor(index / 4) + 1;
  const positionInTable = index % 4;
  return {
    table: `T${String(tableNumber).padStart(2, "0")}`,
    row: positionInTable < 2 ? "A" : "B",
    column: String((positionInTable % 2) + 1).padStart(2, "0"),
  };
}

function formatSeatLabel(seat) {
  return [seat.table, seat.row, seat.column]
    .map((value) => String(value ?? "").trim() || "?")
    .join("-");
}

function seatIdentityFromStoredValue(seat, index) {
  if (seat.table != null && seat.row != null && seat.column != null) {
    return {
      table: String(seat.table).trim(),
      row: String(seat.row).trim(),
      column: String(seat.column).trim(),
    };
  }

  const parts = String(seat.label || "")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 3) return { table: parts[0], row: parts[1], column: parts[2] };
  return defaultSeatIdentity(index);
}

function isValidPlanPosition(position) {
  return Boolean(
    position &&
      Number.isFinite(Number(position.x)) &&
      Number.isFinite(Number(position.y)) &&
      Number(position.x) >= 0 &&
      Number(position.x) <= 1 &&
      Number(position.y) >= 0 &&
      Number(position.y) <= 1,
  );
}

function isValidTablePosition(position) {
  return Boolean(
    position &&
      Number.isFinite(Number(position.x)) &&
      Number.isFinite(Number(position.y)) &&
      Number(position.x) >= 0 &&
      Number(position.x) <= 1 &&
      Number(position.y) >= 0 &&
      Number(position.y) <= 1,
  );
}

function normalizeSeat(seat, index) {
  const identity = seatIdentityFromStoredValue(seat, index);
  const fallbackX = 0.08 + (index % 6) * 0.14;
  const fallbackY = 0.1 + Math.floor(index / 6) * 0.24;
  const normalized = {
    uid: seat.uid || `seat-${Date.now()}-${index}`,
    ...identity,
    polygon: Array.isArray(seat.polygon) && seat.polygon.length >= 3 ? seat.polygon : makeRect(fallbackX, fallbackY, fallbackX + 0.1, fallbackY + 0.16),
    planPosition: isValidPlanPosition(seat.planPosition)
      ? { x: Number(seat.planPosition.x), y: Number(seat.planPosition.y) }
      : null,
    status: STATUS[seat.status] ? seat.status : "empty",
    awayStartedAt: seat.awayStartedAt || null,
  };
  normalized.label = formatSeatLabel(normalized);
  return normalized;
}

function createDefaultSeats() {
  const now = Date.now();
  const definitions = [
    ["T01", "A", "01", makeRect(0.245, 0.14, 0.36, 0.38), "occupied", null],
    ["T01", "A", "02", makeRect(0.38, 0.14, 0.49, 0.38), "occupied", null],
    ["T01", "B", "01", makeRect(0.515, 0.14, 0.62, 0.38), "away", now - 7 * 60 * 1000 - 18 * 1000],
    ["T01", "B", "02", makeRect(0.63, 0.14, 0.75, 0.38), "empty", null],
    ["T02", "A", "01", makeRect(0.195, 0.31, 0.335, 0.6), "occupied", null],
    ["T02", "A", "02", makeRect(0.35, 0.31, 0.49, 0.6), "empty", null],
    ["T02", "B", "01", makeRect(0.515, 0.31, 0.655, 0.6), "noshow", now - 26 * 60 * 1000 - 41 * 1000],
    ["T02", "B", "02", makeRect(0.66, 0.31, 0.8, 0.6), "occupied", null],
    ["T03", "A", "01", makeRect(0.11, 0.5, 0.29, 0.87), "empty", null],
    ["T03", "A", "02", makeRect(0.32, 0.5, 0.48, 0.87), "occupied", null],
    ["T03", "B", "01", makeRect(0.52, 0.5, 0.68, 0.87), "away", now - 12 * 60 * 1000 - 4 * 1000],
    ["T03", "B", "02", makeRect(0.69, 0.5, 0.87, 0.87), "occupied", null],
  ];

  const seats = definitions.map(([table, row, column, polygon, status, awayStartedAt], index) => {
    const seat = {
      uid: `seat-${index + 1}`,
      table,
      row,
      column,
      polygon,
      planPosition: null,
      status,
      awayStartedAt,
    };
    seat.label = formatSeatLabel(seat);
    return seat;
  });
  return seats;
}

function defaultState() {
  const seats = createDefaultSeats();
  const tablePositions = autoArrangePlan(seats);
  return {
    version: 5,
    layoutVersion: 1,
    noShowLimit: 20,
    detectionConfig: { confidence: 0.35, classPreset: "library" },
    lastUpdated: Date.now(),
    tablePositions,
    seats,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.seats)) return defaultState();
    parsed.seats = parsed.seats.map(normalizeSeat);
    const tables = groupSeatsByTable(parsed.seats).map((group) => group.table);
    const canReuseTablePositions =
      Number(parsed.version) >= 4 &&
      parsed.tablePositions &&
      tables.every((table) => isValidTablePosition(parsed.tablePositions[table]));
    const savedTablePositions = canReuseTablePositions
      ? Object.fromEntries(
          tables.map((table) => [
            table,
            {
              ...parsed.tablePositions[table],
              x: Number(parsed.tablePositions[table].x),
              y: Number(parsed.tablePositions[table].y),
            },
          ]),
        )
      : null;
    const tablePositions = savedTablePositions
      ? tablePositionsFromLayout(buildTablePlan(parsed.seats, savedTablePositions))
      : autoArrangePlan(parsed.seats);
    snapSeatsToTableGrids(parsed.seats, tablePositions);
    return { ...defaultState(), ...parsed, version: 5, tablePositions, seats: parsed.seats };
  } catch {
    return defaultState();
  }
}

let state = loadState();
let roiState = null;
let dashboardInterval = null;
let dashboardDrag = null;

const app = document.getElementById("app");
const toastRegion = document.getElementById("toast-region");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

saveState();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icon(type === "error" ? "warning" : "check")}<span>${escapeHtml(message)}</span>`;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function showConfirm({ title, message, confirmLabel = "확인", danger = false, onConfirm }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-neutral" data-modal-cancel>취소</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </section>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-modal-cancel]")) close();
    if (event.target.closest("[data-modal-confirm]")) {
      close();
      onConfirm?.();
    }
  });
  backdrop.querySelector("[data-modal-confirm]").focus();
}

function currentRoute() {
  return (location.hash || "#login").replace(/^#\/?/, "");
}

function navigate(route) {
  if (currentRoute() === route) {
    renderRoute();
  } else {
    location.hash = route;
  }
}

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatDuration(startedAt) {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function topbar(active) {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <span class="brand-mark"><img class="brand-logo" src="assets/library-seat-logo.png" alt="" /></span>
          <span>도서관 좌석 관리 시스템</span>
        </div>
        <div class="topbar-actions">
          <nav class="topnav" aria-label="주요 메뉴">
            <button type="button" id="nav-dashboard" class="nav-link ${active === "dashboard" ? "active" : ""}" aria-label="좌석 현황" title="좌석 현황">
              ${icon("dashboard")}<span class="nav-text">좌석 현황</span>
            </button>
            <button type="button" id="nav-roi" class="nav-link ${active === "roi" ? "active" : ""}" aria-label="좌석 영역 설정" title="좌석 영역 설정">
              ${icon("settings")}<span class="nav-text">좌석 영역 설정</span>
            </button>
          </nav>
          <span class="admin-chip">관리자</span>
          <button type="button" id="logout-button" class="btn btn-ghost btn-icon" aria-label="로그아웃" title="로그아웃">
            ${icon("logout")}
          </button>
        </div>
      </div>
    </header>`;
}

function bindTopbar() {
  document.getElementById("nav-dashboard")?.addEventListener("click", () => {
    if (currentRoute() === "roi" && roiState?.phase === 3 && roiState.dirty) {
      showConfirm({
        title: "편집을 종료할까요?",
        message: "저장하지 않은 좌석 영역 변경사항은 사라집니다.",
        confirmLabel: "변경 취소",
        danger: true,
        onConfirm: () => {
          roiState = null;
          navigate("dashboard");
        },
      });
      return;
    }
    roiState = null;
    navigate("dashboard");
  });
  document.getElementById("nav-roi")?.addEventListener("click", () => navigate("roi"));
  document.getElementById("logout-button")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    roiState = null;
    navigate("login");
  });
}

function renderLogin() {
  clearInterval(dashboardInterval);
  window.scrollTo(0, 0);
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card" aria-labelledby="login-title">
        <div class="login-card-body">
          <div class="login-mark"><img class="brand-logo" src="assets/library-seat-logo.png" alt="" /></div>
          <h1 id="login-title" class="login-title">도서관 좌석 관리 시스템</h1>
          <p class="login-subtitle">관리자 로그인</p>
          <form id="login-form" class="login-form">
            <div>
              <label class="field-label" for="admin-id">아이디 (ID)</label>
              <div class="input-wrap">
                ${icon("user")}
                <input class="input" id="admin-id" name="id" autocomplete="username" placeholder="관리자 아이디를 입력하세요" required />
              </div>
            </div>
            <div>
              <label class="field-label" for="admin-password">비밀번호 (Password)</label>
              <div class="input-wrap">
                ${icon("key")}
                <input class="input" id="admin-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required />
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-lg btn-block">로그인 ${icon("login")}</button>
          </form>
          <div class="prototype-note">${icon("info")}<span>프로토타입에서는 아이디와 비밀번호에 아무 값이나 입력하면 로그인할 수 있습니다.</span></div>
        </div>
        <div class="login-footer"></div>
      </section>
    </main>`;

  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem(SESSION_KEY, "true");
    navigate("dashboard");
  });
  document.getElementById("admin-id").focus();
}

function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value)))].sort((a, b) => NATURAL_COLLATOR.compare(a, b));
}

function groupSeatsByTable(seats) {
  const grouped = new Map();
  seats.forEach((seat) => {
    const key = String(seat.table);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(seat);
  });
  return [...grouped.entries()]
    .sort(([a], [b]) => NATURAL_COLLATOR.compare(a, b))
    .map(([table, tableSeats]) => ({ table, seats: tableSeats }));
}

function rowIndexFromValue(value, fallback = 0) {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^[A-Z]+$/.test(text)) {
    return [...text].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  }
  const numeric = Number(text);
  return Number.isInteger(numeric) && numeric > 0 ? numeric - 1 : fallback;
}

function columnIndexFromValue(value, fallback = 0) {
  const numeric = Number(String(value ?? "").trim());
  return Number.isInteger(numeric) && numeric > 0 ? numeric - 1 : fallback;
}

function rowLabelFromIndex(index) {
  let value = Math.max(0, index) + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function columnLabelFromIndex(index) {
  return String(Math.max(0, index) + 1).padStart(2, "0");
}

function seatGridCell(group, seat) {
  const rowFallback = Math.max(0, group.rows.indexOf(String(seat.row)));
  const columnFallback = Math.max(0, group.columns.indexOf(String(seat.column)));
  return {
    rowIndex: Math.min(group.gridRows - 1, rowIndexFromValue(seat.row, rowFallback)),
    columnIndex: Math.min(group.gridColumns - 1, columnIndexFromValue(seat.column, columnFallback)),
  };
}

function buildTablePlan(seats, tablePositions = {}) {
  const grouped = groupSeatsByTable(seats);
  if (!grouped.length) return { groups: [], positions: new Map(), groupByTable: new Map() };

  const gapX = 30;
  const gapY = 30;
  const marginX = 50;
  const positions = new Map();
  const definitions = grouped.map((group) => {
    const storedPosition = tablePositions[group.table];
    const rows = sortedUnique(group.seats.map((seat) => seat.row));
    const columns = sortedUnique(group.seats.map((seat) => seat.column));
    const requiredRows = Math.max(0, ...group.seats.map((seat, seatIndex) => rowIndexFromValue(seat.row, seatIndex))) + 1;
    const requiredColumns = Math.max(0, ...group.seats.map((seat, seatIndex) => columnIndexFromValue(seat.column, seatIndex))) + 1;
    const storedRows = Number(storedPosition?.gridRows);
    const storedColumns = Number(storedPosition?.gridColumns);
    const gridRows = Math.min(
      TABLE_GRID.maxRows,
      Math.max(requiredRows, Number.isInteger(storedRows) && storedRows > 0 ? storedRows : 3),
    );
    const gridColumns = Math.min(
      TABLE_GRID.maxColumns,
      Math.max(requiredColumns, Number.isInteger(storedColumns) && storedColumns > 0 ? storedColumns : 3),
    );
    return {
      ...group,
      rows,
      columns,
      gridRows,
      gridColumns,
      width: gridColumns * TABLE_GRID.cellWidth + TABLE_GRID.paddingX,
      height: gridRows * TABLE_GRID.cellHeight + TABLE_GRID.paddingY,
    };
  });

  const automaticRows = [];
  definitions.forEach((definition) => {
    let row = automaticRows[automaticRows.length - 1];
    const nextWidth = row ? row.width + gapX + definition.width : definition.width;
    if (!row || nextWidth > PLAN_VIEWBOX.width - marginX * 2) {
      row = { items: [], width: 0, height: 0 };
      automaticRows.push(row);
    }
    row.width += (row.items.length ? gapX : 0) + definition.width;
    row.height = Math.max(row.height, definition.height);
    row.items.push(definition);
  });
  const totalHeight = automaticRows.reduce((sum, row) => sum + row.height, 0) + gapY * Math.max(0, automaticRows.length - 1);
  let automaticY = Math.max(18, (PLAN_VIEWBOX.height - totalHeight) / 2);
  const automaticZones = new Map();
  automaticRows.forEach((row) => {
    let automaticX = Math.max(18, (PLAN_VIEWBOX.width - row.width) / 2);
    row.items.forEach((definition) => {
      automaticZones.set(definition.table, {
        x: automaticX,
        y: automaticY,
        width: definition.width,
        height: definition.height,
      });
      automaticX += definition.width + gapX;
    });
    automaticY += row.height + gapY;
  });

  const groups = definitions.map((definition) => {
    const storedPosition = tablePositions[definition.table];
    const automaticZone = automaticZones.get(definition.table);
    const zone = {
      ...automaticZone,
      x: isValidTablePosition(storedPosition)
        ? Math.max(0, Math.min(PLAN_VIEWBOX.width - definition.width, Number(storedPosition.x) * PLAN_VIEWBOX.width))
        : automaticZone.x,
      y: isValidTablePosition(storedPosition)
        ? Math.max(0, Math.min(PLAN_VIEWBOX.height - definition.height, Number(storedPosition.y) * PLAN_VIEWBOX.height))
        : automaticZone.y,
    };
    const innerLeft = zone.x + 20;
    const innerTop = zone.y + 52;
    const innerWidth = zone.width - 40;
    const innerHeight = zone.height - 70;
    const seatWidth = Math.max(42, Math.min(70, innerWidth / definition.gridColumns - 10));
    const seatHeight = Math.max(32, Math.min(44, innerHeight / definition.gridRows - 10));
    const layoutGroup = {
      ...definition,
      ...zone,
      innerLeft,
      innerTop,
      innerWidth,
      innerHeight,
      seatWidth,
      seatHeight,
    };

    definition.seats.forEach((seat) => {
      const { columnIndex, rowIndex } = seatGridCell(layoutGroup, seat);
      positions.set(seat.uid, {
        x: innerLeft + innerWidth * ((columnIndex + 0.5) / definition.gridColumns),
        y: innerTop + innerHeight * ((rowIndex + 0.5) / definition.gridRows),
      });
    });

    return layoutGroup;
  });

  return {
    groups,
    positions,
    groupByTable: new Map(groups.map((group) => [group.table, group])),
  };
}

function tablePositionsFromLayout(layout) {
  return Object.fromEntries(
    layout.groups.map((group) => [
      group.table,
      {
        x: group.x / PLAN_VIEWBOX.width,
        y: group.y / PLAN_VIEWBOX.height,
        width: group.width / PLAN_VIEWBOX.width,
        height: group.height / PLAN_VIEWBOX.height,
        gridRows: group.gridRows,
        gridColumns: group.gridColumns,
      },
    ]),
  );
}

function snapSeatsToTableGrids(seats, tablePositions) {
  const layout = buildTablePlan(seats, tablePositions);
  seats.forEach((seat) => {
    const position = layout.positions.get(seat.uid);
    if (!position) return;
    seat.planPosition = {
      x: position.x / PLAN_VIEWBOX.width,
      y: position.y / PLAN_VIEWBOX.height,
    };
  });
  return layout;
}

function autoArrangePlan(seats, existingTablePositions = {}) {
  const preservedGridSizes = Object.fromEntries(
    Object.entries(existingTablePositions).map(([table, config]) => [
      table,
      { ...config, x: Number.NaN, y: Number.NaN },
    ]),
  );
  const automaticLayout = buildTablePlan(seats, preservedGridSizes);
  const tablePositions = tablePositionsFromLayout(automaticLayout);
  snapSeatsToTableGrids(seats, tablePositions);
  return tablePositions;
}

function seatPlanCoordinates(seat, layout) {
  if (isValidPlanPosition(seat.planPosition)) {
    return {
      x: Number(seat.planPosition.x) * PLAN_VIEWBOX.width,
      y: Number(seat.planPosition.y) * PLAN_VIEWBOX.height,
    };
  }
  return layout.positions.get(seat.uid) || { x: PLAN_VIEWBOX.width / 2, y: PLAN_VIEWBOX.height / 2 };
}

function renderGridOverlay(group) {
  const innerX = group.innerLeft - group.x;
  const innerY = group.innerTop - group.y;
  const verticalLines = Array.from({ length: group.gridColumns + 1 }, (_, index) => {
    const x = innerX + (group.innerWidth * index) / group.gridColumns;
    return `<line x1="${x.toFixed(1)}" y1="${innerY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(innerY + group.innerHeight).toFixed(1)}"></line>`;
  }).join("");
  const horizontalLines = Array.from({ length: group.gridRows + 1 }, (_, index) => {
    const y = innerY + (group.innerHeight * index) / group.gridRows;
    return `<line x1="${innerX.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(innerX + group.innerWidth).toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
  }).join("");
  return `<g class="table-grid-overlay" aria-hidden="true"><rect x="${innerX.toFixed(1)}" y="${innerY.toFixed(1)}" width="${group.innerWidth.toFixed(1)}" height="${group.innerHeight.toFixed(1)}" rx="10"></rect>${verticalLines}${horizontalLines}<text class="table-grid-size" x="${(innerX + group.innerWidth / 2).toFixed(1)}" y="${(innerY + group.innerHeight / 2).toFixed(1)}">${group.gridColumns} × ${group.gridRows}</text></g>`;
}

function renderResizeHandles(group) {
  return [
    ["nw", 0, 0, "왼쪽 위"],
    ["ne", group.width, 0, "오른쪽 위"],
    ["sw", 0, group.height, "왼쪽 아래"],
    ["se", group.width, group.height, "오른쪽 아래"],
  ]
    .map(
      ([corner, x, y, label]) => `<g class="table-resize-handle" data-corner="${corner}" transform="translate(${Number(x).toFixed(1)} ${Number(y).toFixed(1)})" role="button" aria-label="테이블 ${escapeHtml(group.table)} ${label} 모서리 크기 조절"><rect class="table-resize-hitbox" x="-14" y="-14" width="28" height="28"></rect></g>`,
    )
    .join("");
}

function renderTableZones(layout) {
  return layout.groups
    .map(
      (group) => `
        <g class="table-zone" data-table-id="${escapeHtml(group.table)}" data-zone-width="${group.width.toFixed(1)}" data-zone-height="${group.height.toFixed(1)}" data-inner-x="${(group.innerLeft - group.x).toFixed(1)}" data-inner-y="${(group.innerTop - group.y).toFixed(1)}" data-inner-width="${group.innerWidth.toFixed(1)}" data-inner-height="${group.innerHeight.toFixed(1)}" data-grid-rows="${group.gridRows}" data-grid-columns="${group.gridColumns}" transform="translate(${group.x.toFixed(1)} ${group.y.toFixed(1)})" tabindex="0" role="group" aria-label="테이블 ${escapeHtml(group.table)}. 본체를 드래그하면 이동하고 모서리를 드래그하면 그리드 크기가 변경됩니다.">
          <rect class="table-zone-surface" x="0" y="0" width="${group.width.toFixed(1)}" height="${group.height.toFixed(1)}" rx="18"></rect>
          ${renderGridOverlay(group)}
          <text class="table-zone-label" x="18" y="24">테이블 ${escapeHtml(group.table)}</text>
          <text class="table-zone-count" x="${(group.width - 18).toFixed(1)}" y="24">${group.seats.length}석</text>
          ${renderResizeHandles(group)}
        </g>`,
    )
    .join("");
}

function renderSeatMap() {
  const layout = buildTablePlan(state.seats, state.tablePositions);
  const seats = state.seats
    .map((seat) => {
      const meta = STATUS[seat.status];
      const position = seatPlanCoordinates(seat, layout);
      const group = layout.groupByTable.get(String(seat.table));
      const width = group?.seatWidth || 86;
      const height = group?.seatHeight || 54;
      const timer = seat.status === "away" || seat.status === "noshow" ? formatDuration(seat.awayStartedAt) : "";
      const subtitle = timer || meta.label;
      return `
        <g class="seat-group" data-seat-uid="${escapeHtml(seat.uid)}" data-seat-width="${width.toFixed(1)}" data-seat-height="${height.toFixed(1)}" transform="translate(${position.x.toFixed(1)} ${position.y.toFixed(1)})" tabindex="0" role="button" aria-label="${escapeHtml(seat.label)} ${meta.label}. 드래그하면 배치 위치가 변경되고 클릭하면 상태가 변경됩니다.">
          <title>${escapeHtml(seat.label)} · ${meta.label}${timer ? ` · ${timer}` : ""}</title>
          <rect class="seat-shape" x="${(-width / 2).toFixed(1)}" y="${(-height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="9" fill="${meta.color}" stroke="${meta.stroke}"></rect>
          <text class="seat-label" x="0" y="-7">${escapeHtml(seat.label)}</text>
          <text class="seat-time ${timer ? "js-away-time" : ""}" ${timer ? `data-start="${seat.awayStartedAt}"` : ""} x="0" y="12">${escapeHtml(subtitle)}</text>
        </g>`;
    })
    .join("");
  return `${renderTableZones(layout)}<rect id="grid-drop-preview" class="grid-drop-preview" x="0" y="0" width="0" height="0" rx="9" visibility="hidden"></rect>${seats}`;
}

function metricCard(label, value, status, iconName) {
  return `
    <article class="metric-card" ${status ? `data-status="${status}"` : ""}>
      <div class="metric-label">${icon(iconName)}<span>${label}</span></div>
      <div class="metric-value">${value}</div>
    </article>`;
}

function renderDashboard() {
  clearInterval(dashboardInterval);
  window.scrollTo(0, 0);
  const counts = STATUS_ORDER.reduce((acc, key) => ({ ...acc, [key]: state.seats.filter((seat) => seat.status === key).length }), {});
  app.innerHTML = `
    <div class="app-shell">
      ${topbar("dashboard")}
      <main class="main-content">
        <header class="page-header">
          <div>
            <h1 class="page-title">좌석 현황 대시보드</h1>
            <p class="page-description">실시간 좌석 점유 상태와 자리 비움 시간을 한눈에 확인하세요.</p>
          </div>
          <div class="header-buttons">
            <button type="button" id="reset-timers" class="btn btn-neutral">${icon("refresh")}타이머 초기화</button>
            <button type="button" id="set-limit" class="btn btn-outline">${icon("timer")}자리 비움 ${state.noShowLimit}분</button>
          </div>
        </header>
        <section class="metrics-grid" aria-label="좌석 상태 요약">
          ${metricCard("비어 있음", counts.empty, "empty", "square")}
          ${metricCard("점유 중", counts.occupied, "occupied", "user")}
          ${metricCard("자리 비움", counts.away, "away", "walk")}
          ${metricCard("노쇼", counts.noshow, "noshow", "warning")}
        </section>
        <section class="panel" aria-labelledby="floorplan-title">
          <header class="panel-header">
            <div class="panel-title" id="floorplan-title">${icon("map", "icon-lg")}Section A</div>
            <div class="legend-area">
              <span class="prototype-badge">테이블 이동 · 모서리 크기 조절 · 좌석 칸 이동</span>
              <div class="legend">
                ${STATUS_ORDER.map((key) => `<span class="legend-item"><span class="legend-dot" style="background:${STATUS[key].color}"></span>${STATUS[key].label}</span>`).join("")}
              </div>
              <span class="last-update">Last Update: <span class="js-last-update">${formatTime(state.lastUpdated)}</span></span>
            </div>
          </header>
          <div class="floorplan-wrap">
            ${
              state.seats.length
                ? `<div class="layout-toolbar"><div class="layout-help"><strong>테이블 이동 · 유동형 좌석 그리드</strong><span>테이블 모서리를 끌면 격자가 나타납니다. 원하는 열 × 행에서 놓으면 좌석이 새 격자에 맞춰집니다.</span></div><button type="button" id="auto-arrange-layout" class="btn btn-neutral btn-sm">${icon("refresh")}자동 정렬</button></div><div class="floorplan-frame"><svg class="seat-map" viewBox="0 0 ${PLAN_VIEWBOX.width} ${PLAN_VIEWBOX.height}" preserveAspectRatio="none" aria-label="테이블 기준으로 위에서 본 좌석 배치도">${renderSeatMap()}</svg></div>`
                : `<div class="empty-layout"><div class="empty-icon">${icon("map", "icon-lg")}</div><h3>아직 설계된 좌석이 없습니다</h3><p>카메라 장면을 캡처하고 테이블·행·열을 지정하면<br />위에서 본 좌석 배치로 자동 정리됩니다.</p><button type="button" id="empty-add-seat" class="btn btn-primary btn-lg">${icon("plus")}좌석 추가하기</button></div>`
            }
          </div>
        </section>
      </main>
    </div>`;

  bindTopbar();
  document.getElementById("empty-add-seat")?.addEventListener("click", () => navigate("roi"));
  document.getElementById("reset-timers")?.addEventListener("click", confirmTimerReset);
  document.getElementById("set-limit")?.addEventListener("click", showLimitModal);
  document.getElementById("auto-arrange-layout")?.addEventListener("click", confirmAutoArrangeLayout);
  document.querySelectorAll(".seat-group").forEach((group) => {
    const activate = () => cycleSeatStatus(group.dataset.seatUid);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });
  bindDashboardSeatMap();
  dashboardInterval = window.setInterval(updateDashboardClocks, 1000);
}

function updateDashboardClocks() {
  document.querySelector(".js-last-update")?.replaceChildren(document.createTextNode(formatTime(state.lastUpdated)));
  document.querySelectorAll(".js-away-time").forEach((node) => {
    node.textContent = formatDuration(Number(node.dataset.start));
  });
}

function confirmAutoArrangeLayout() {
  showConfirm({
    title: "테이블 기준으로 자동 정렬할까요?",
    message: "수동으로 조정한 좌석 위치를 테이블·행·열 순서로 다시 정리합니다. 좌석 상태와 타이머는 유지됩니다.",
    confirmLabel: "자동 정렬",
    onConfirm: () => {
      state.tablePositions = autoArrangePlan(state.seats, state.tablePositions);
      state.lastUpdated = Date.now();
      saveState();
      renderDashboard();
      showToast("테이블·행·열 기준으로 좌석 배치를 정리했습니다.");
    },
  });
}

function dashboardPointFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return [
    Math.max(0, Math.min(PLAN_VIEWBOX.width, ((event.clientX - rect.left) / rect.width) * PLAN_VIEWBOX.width)),
    Math.max(0, Math.min(PLAN_VIEWBOX.height, ((event.clientY - rect.top) / rect.height) * PLAN_VIEWBOX.height)),
  ];
}

function bindDashboardSeatMap() {
  const svg = document.querySelector(".seat-map");
  if (!svg) return;
  svg.addEventListener("pointerdown", handleDashboardPointerDown);
  svg.addEventListener("pointermove", handleDashboardPointerMove);
  svg.addEventListener("pointerup", (event) => handleDashboardPointerEnd(event, false));
  svg.addEventListener("pointercancel", (event) => handleDashboardPointerEnd(event, true));
}

function planCellFromPoint(point, layout) {
  const groups = [...layout.groups].reverse();
  for (const group of groups) {
    const inside =
      point[0] >= group.innerLeft &&
      point[0] <= group.innerLeft + group.innerWidth &&
      point[1] >= group.innerTop &&
      point[1] <= group.innerTop + group.innerHeight;
    if (!inside) continue;
    const columnIndex = Math.min(
      group.gridColumns - 1,
      Math.max(0, Math.floor(((point[0] - group.innerLeft) / group.innerWidth) * group.gridColumns)),
    );
    const rowIndex = Math.min(
      group.gridRows - 1,
      Math.max(0, Math.floor(((point[1] - group.innerTop) / group.innerHeight) * group.gridRows)),
    );
    return {
      table: group.table,
      rowIndex,
      columnIndex,
      row: rowLabelFromIndex(rowIndex),
      column: columnLabelFromIndex(columnIndex),
      centerX: group.innerLeft + group.innerWidth * ((columnIndex + 0.5) / group.gridColumns),
      centerY: group.innerTop + group.innerHeight * ((rowIndex + 0.5) / group.gridRows),
      width: group.seatWidth,
      height: group.seatHeight,
    };
  }
  return null;
}

function showGridDropPreview(target) {
  const preview = document.getElementById("grid-drop-preview");
  if (!preview) return;
  if (!target) {
    preview.setAttribute("visibility", "hidden");
    return;
  }
  preview.setAttribute("x", (target.centerX - target.width / 2).toFixed(1));
  preview.setAttribute("y", (target.centerY - target.height / 2).toFixed(1));
  preview.setAttribute("width", target.width.toFixed(1));
  preview.setAttribute("height", target.height.toFixed(1));
  preview.setAttribute("visibility", "visible");
}

function sortedSeatsForTable(table) {
  return state.seats
    .filter((seat) => String(seat.table) === String(table))
    .sort((a, b) => {
      const rowDifference = rowIndexFromValue(a.row) - rowIndexFromValue(b.row);
      if (rowDifference) return rowDifference;
      const columnDifference = columnIndexFromValue(a.column) - columnIndexFromValue(b.column);
      return columnDifference || NATURAL_COLLATOR.compare(a.label, b.label);
    });
}

function resizeCandidateFromPoint(drag, point) {
  const west = drag.corner.includes("w");
  const north = drag.corner.includes("n");
  const availableWidth = west ? drag.anchorX : PLAN_VIEWBOX.width - drag.anchorX;
  const availableHeight = north ? drag.anchorY : PLAN_VIEWBOX.height - drag.anchorY;
  const maximumColumns = Math.max(
    1,
    Math.min(TABLE_GRID.maxColumns, Math.floor((availableWidth - TABLE_GRID.paddingX) / TABLE_GRID.cellWidth)),
  );
  const maximumRows = Math.max(
    1,
    Math.min(TABLE_GRID.maxRows, Math.floor((availableHeight - TABLE_GRID.paddingY) / TABLE_GRID.cellHeight)),
  );
  const rawWidth = Math.abs(point[0] - drag.anchorX);
  const rawHeight = Math.abs(point[1] - drag.anchorY);
  const gridColumns = Math.max(
    1,
    Math.min(maximumColumns, Math.round((rawWidth - TABLE_GRID.paddingX) / TABLE_GRID.cellWidth)),
  );
  const gridRows = Math.max(
    1,
    Math.min(maximumRows, Math.round((rawHeight - TABLE_GRID.paddingY) / TABLE_GRID.cellHeight)),
  );
  const width = gridColumns * TABLE_GRID.cellWidth + TABLE_GRID.paddingX;
  const height = gridRows * TABLE_GRID.cellHeight + TABLE_GRID.paddingY;
  return {
    x: west ? drag.anchorX - width : drag.anchorX,
    y: north ? drag.anchorY - height : drag.anchorY,
    width,
    height,
    gridColumns,
    gridRows,
    valid: gridColumns * gridRows >= drag.seatCount,
  };
}

function gridOverlayInnerMarkup(candidate) {
  const innerX = 20;
  const innerY = 52;
  const innerWidth = candidate.width - TABLE_GRID.paddingX;
  const innerHeight = candidate.height - TABLE_GRID.paddingY;
  const verticalLines = Array.from({ length: candidate.gridColumns + 1 }, (_, index) => {
    const x = innerX + (innerWidth * index) / candidate.gridColumns;
    return `<line x1="${x.toFixed(1)}" y1="${innerY}" x2="${x.toFixed(1)}" y2="${(innerY + innerHeight).toFixed(1)}"></line>`;
  }).join("");
  const horizontalLines = Array.from({ length: candidate.gridRows + 1 }, (_, index) => {
    const y = innerY + (innerHeight * index) / candidate.gridRows;
    return `<line x1="${innerX}" y1="${y.toFixed(1)}" x2="${(innerX + innerWidth).toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
  }).join("");
  const label = candidate.valid
    ? `${candidate.gridColumns} × ${candidate.gridRows}`
    : `${candidate.gridColumns} × ${candidate.gridRows} · ${candidate.seatCount}석 수용 불가`;
  return `<rect x="${innerX}" y="${innerY}" width="${innerWidth.toFixed(1)}" height="${innerHeight.toFixed(1)}" rx="10"></rect>${verticalLines}${horizontalLines}<text class="table-grid-size" x="${(innerX + innerWidth / 2).toFixed(1)}" y="${(innerY + innerHeight / 2).toFixed(1)}">${label}</text>`;
}

function updateTableResizePreview(drag, candidate) {
  const tableGroup = drag.group;
  tableGroup.setAttribute("transform", `translate(${candidate.x.toFixed(1)} ${candidate.y.toFixed(1)})`);
  tableGroup.dataset.zoneWidth = candidate.width.toFixed(1);
  tableGroup.dataset.zoneHeight = candidate.height.toFixed(1);
  tableGroup.dataset.innerWidth = (candidate.width - TABLE_GRID.paddingX).toFixed(1);
  tableGroup.dataset.innerHeight = (candidate.height - TABLE_GRID.paddingY).toFixed(1);
  tableGroup.dataset.gridColumns = String(candidate.gridColumns);
  tableGroup.dataset.gridRows = String(candidate.gridRows);
  tableGroup.classList.toggle("is-invalid-size", !candidate.valid);
  tableGroup.querySelector(".table-zone-surface")?.setAttribute("width", candidate.width.toFixed(1));
  tableGroup.querySelector(".table-zone-surface")?.setAttribute("height", candidate.height.toFixed(1));
  tableGroup.querySelector(".table-zone-count")?.setAttribute("x", (candidate.width - 18).toFixed(1));
  const handlePositions = {
    nw: [0, 0],
    ne: [candidate.width, 0],
    sw: [0, candidate.height],
    se: [candidate.width, candidate.height],
  };
  Object.entries(handlePositions).forEach(([corner, [x, y]]) => {
    tableGroup.querySelector(`.table-resize-handle[data-corner="${corner}"]`)?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  });
  const overlay = tableGroup.querySelector(".table-grid-overlay");
  if (overlay) overlay.innerHTML = gridOverlayInnerMarkup({ ...candidate, seatCount: drag.seatCount });

  if (!candidate.valid) {
    drag.originalSeatTransforms.forEach((transform, uid) => {
      document.querySelector(`.seat-group[data-seat-uid="${CSS.escape(uid)}"]`)?.setAttribute("transform", transform);
    });
    return;
  }
  drag.orderedSeats.forEach((seat, index) => {
    const rowIndex = Math.floor(index / candidate.gridColumns);
    const columnIndex = index % candidate.gridColumns;
    const x = candidate.x + 20 + TABLE_GRID.cellWidth * (columnIndex + 0.5);
    const y = candidate.y + 52 + TABLE_GRID.cellHeight * (rowIndex + 0.5);
    document.querySelector(`.seat-group[data-seat-uid="${CSS.escape(seat.uid)}"]`)?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  });
}

function handleDashboardPointerDown(event) {
  if (event.button !== 0) return;
  const seatGroup = event.target.closest(".seat-group");
  const tableGroup = event.target.closest(".table-zone");
  const resizeHandle = event.target.closest(".table-resize-handle");
  const start = dashboardPointFromEvent(event);
  if (seatGroup) {
    const seat = state.seats.find((item) => item.uid === seatGroup.dataset.seatUid);
    if (!seat || !isValidPlanPosition(seat.planPosition)) return;
    dashboardDrag = {
      type: "seat",
      uid: seat.uid,
      group: seatGroup,
      start,
      original: { x: Number(seat.planPosition.x), y: Number(seat.planPosition.y) },
      originalIdentity: { table: seat.table, row: seat.row, column: seat.column },
      width: Number(seatGroup.dataset.seatWidth) || 86,
      height: Number(seatGroup.dataset.seatHeight) || 54,
      targetCell: null,
      moved: false,
    };
  } else if (resizeHandle && tableGroup) {
    const table = tableGroup.dataset.tableId;
    const layout = buildTablePlan(state.seats, state.tablePositions);
    const planGroup = layout.groupByTable.get(table);
    if (!planGroup) return;
    const corner = resizeHandle.dataset.corner;
    const orderedSeats = sortedSeatsForTable(table);
    dashboardDrag = {
      type: "resize",
      table,
      corner,
      group: tableGroup,
      start,
      anchorX: corner.includes("w") ? planGroup.x + planGroup.width : planGroup.x,
      anchorY: corner.includes("n") ? planGroup.y + planGroup.height : planGroup.y,
      original: { ...state.tablePositions[table] },
      orderedSeats,
      seatCount: orderedSeats.length,
      originalSeatTransforms: new Map(
        orderedSeats.map((seat) => [
          seat.uid,
          document.querySelector(`.seat-group[data-seat-uid="${CSS.escape(seat.uid)}"]`)?.getAttribute("transform") || "",
        ]),
      ),
      candidate: null,
      moved: false,
    };
  } else if (tableGroup) {
    const table = tableGroup.dataset.tableId;
    const layout = buildTablePlan(state.seats, state.tablePositions);
    const planGroup = layout.groupByTable.get(table);
    if (!planGroup) return;
    dashboardDrag = {
      type: "table",
      table,
      group: tableGroup,
      start,
      original: {
        x: planGroup.x / PLAN_VIEWBOX.width,
        y: planGroup.y / PLAN_VIEWBOX.height,
      },
      width: planGroup.width,
      height: planGroup.height,
      moved: false,
    };
  } else {
    return;
  }
  dashboardDrag.group.classList.add(dashboardDrag.type === "resize" ? "is-resizing" : "is-dragging");
  event.currentTarget.classList.add(dashboardDrag.type === "resize" ? "is-resizing" : "is-dragging");
  dashboardDrag.group.focus({ preventScroll: true });
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handleDashboardPointerMove(event) {
  if (!dashboardDrag) return;
  const point = dashboardPointFromEvent(event);
  const dx = point[0] - dashboardDrag.start[0];
  const dy = point[1] - dashboardDrag.start[1];
  if (!dashboardDrag.moved && Math.hypot(dx, dy) < 4) return;

  dashboardDrag.moved = true;
  if (dashboardDrag.type === "resize") {
    dashboardDrag.candidate = resizeCandidateFromPoint(dashboardDrag, point);
    updateTableResizePreview(dashboardDrag, dashboardDrag.candidate);
    return;
  }

  if (dashboardDrag.type === "table") {
    const x = Math.max(
      0,
      Math.min(PLAN_VIEWBOX.width - dashboardDrag.width, dashboardDrag.original.x * PLAN_VIEWBOX.width + dx),
    );
    const y = Math.max(
      0,
      Math.min(PLAN_VIEWBOX.height - dashboardDrag.height, dashboardDrag.original.y * PLAN_VIEWBOX.height + dy),
    );
    state.tablePositions[dashboardDrag.table] = {
      ...state.tablePositions[dashboardDrag.table],
      x: x / PLAN_VIEWBOX.width,
      y: y / PLAN_VIEWBOX.height,
    };
    const layout = snapSeatsToTableGrids(state.seats, state.tablePositions);
    dashboardDrag.group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    layout.groupByTable.get(dashboardDrag.table)?.seats.forEach((member) => {
      const memberPosition = layout.positions.get(member.uid);
      const memberNode = document.querySelector(`.seat-group[data-seat-uid="${CSS.escape(member.uid)}"]`);
      if (memberPosition && memberNode) {
        memberNode.setAttribute("transform", `translate(${memberPosition.x.toFixed(1)} ${memberPosition.y.toFixed(1)})`);
      }
    });
    return;
  }

  const seat = state.seats.find((item) => item.uid === dashboardDrag.uid);
  if (!seat) return;
  const halfWidth = dashboardDrag.width / 2;
  const halfHeight = dashboardDrag.height / 2;
  const x = Math.max(halfWidth, Math.min(PLAN_VIEWBOX.width - halfWidth, dashboardDrag.original.x * PLAN_VIEWBOX.width + dx));
  const y = Math.max(halfHeight, Math.min(PLAN_VIEWBOX.height - halfHeight, dashboardDrag.original.y * PLAN_VIEWBOX.height + dy));
  seat.planPosition = { x: x / PLAN_VIEWBOX.width, y: y / PLAN_VIEWBOX.height };
  dashboardDrag.group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  dashboardDrag.targetCell = planCellFromPoint(point, buildTablePlan(state.seats, state.tablePositions));
  showGridDropPreview(dashboardDrag.targetCell);
}

function handleDashboardPointerEnd(event, cancelled) {
  if (!dashboardDrag) return;
  const drag = dashboardDrag;
  dashboardDrag = null;
  try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
  event.currentTarget.classList.remove("is-dragging");
  event.currentTarget.classList.remove("is-resizing");
  drag.group.classList.remove("is-dragging");
  drag.group.classList.remove("is-resizing", "is-invalid-size");

  if (cancelled) {
    if (drag.type === "table") {
      state.tablePositions[drag.table] = drag.original;
      snapSeatsToTableGrids(state.seats, state.tablePositions);
    } else if (drag.type === "seat") {
      const cancelledSeat = state.seats.find((item) => item.uid === drag.uid);
      if (cancelledSeat) cancelledSeat.planPosition = drag.original;
    }
    renderDashboard();
    return;
  }

  if (!drag.moved) {
    if (drag.type === "seat") cycleSeatStatus(drag.uid);
    return;
  }

  if (drag.type === "resize") {
    if (!drag.candidate?.valid) {
      renderDashboard();
      showToast(`${drag.table} 테이블의 ${drag.seatCount}개 좌석을 모두 담을 수 있는 격자를 선택해 주세요.`, "error");
      return;
    }
    drag.orderedSeats.forEach((seat, index) => {
      const rowIndex = Math.floor(index / drag.candidate.gridColumns);
      const columnIndex = index % drag.candidate.gridColumns;
      seat.row = rowLabelFromIndex(rowIndex);
      seat.column = columnLabelFromIndex(columnIndex);
      seat.label = formatSeatLabel(seat);
    });
    state.tablePositions[drag.table] = {
      x: drag.candidate.x / PLAN_VIEWBOX.width,
      y: drag.candidate.y / PLAN_VIEWBOX.height,
      width: drag.candidate.width / PLAN_VIEWBOX.width,
      height: drag.candidate.height / PLAN_VIEWBOX.height,
      gridRows: drag.candidate.gridRows,
      gridColumns: drag.candidate.gridColumns,
    };
    snapSeatsToTableGrids(state.seats, state.tablePositions);
    state.lastUpdated = Date.now();
    saveState();
    renderDashboard();
    showToast(`테이블 ${drag.table}을 ${drag.candidate.gridColumns} × ${drag.candidate.gridRows} 격자로 변경했습니다.`);
    return;
  }

  if (drag.type === "table") {
    state.lastUpdated = Date.now();
    saveState();
    updateDashboardClocks();
    showToast(`테이블 ${drag.table}과 소속 좌석 위치를 저장했습니다.`);
    return;
  }

  const seat = state.seats.find((item) => item.uid === drag.uid);
  if (!seat) return;
  showGridDropPreview(null);
  if (!drag.targetCell) {
    seat.planPosition = drag.original;
    renderDashboard();
    showToast("좌석을 테이블 안의 원하는 칸에 놓아주세요.", "error");
    return;
  }

  const layoutBeforeDrop = buildTablePlan(state.seats, state.tablePositions);
  const occupant = state.seats.find((item) => {
    if (item.uid === seat.uid || String(item.table) !== drag.targetCell.table) return false;
    const group = layoutBeforeDrop.groupByTable.get(String(item.table));
    if (!group) return false;
    const cell = seatGridCell(group, item);
    return cell.rowIndex === drag.targetCell.rowIndex && cell.columnIndex === drag.targetCell.columnIndex;
  });
  if (occupant) {
    occupant.table = drag.originalIdentity.table;
    occupant.row = drag.originalIdentity.row;
    occupant.column = drag.originalIdentity.column;
    occupant.label = formatSeatLabel(occupant);
  }
  seat.table = drag.targetCell.table;
  seat.row = drag.targetCell.row;
  seat.column = drag.targetCell.column;
  seat.label = formatSeatLabel(seat);
  snapSeatsToTableGrids(state.seats, state.tablePositions);
  state.lastUpdated = Date.now();
  saveState();
  renderDashboard();
  showToast(occupant ? `${seat.label} 칸으로 이동하고 두 좌석의 위치를 맞바꿨습니다.` : `${seat.label} 칸에 좌석을 배치했습니다.`);
}

function cycleSeatStatus(uid) {
  const seat = state.seats.find((item) => item.uid === uid);
  if (!seat) return;
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(seat.status) + 1) % STATUS_ORDER.length];
  seat.status = next;
  if (next === "away") seat.awayStartedAt = Date.now();
  if (next === "empty" || next === "occupied") seat.awayStartedAt = null;
  state.lastUpdated = Date.now();
  saveState();
  renderDashboard();
  showToast(`${seat.label} 상태를 '${STATUS[next].label}'으로 변경했습니다.`);
}

function confirmTimerReset() {
  showConfirm({
    title: "전체 타이머를 초기화할까요?",
    message: "자리 비움 좌석은 0분부터 다시 시작하고, 노쇼 좌석은 자리 비움 상태로 돌아갑니다.",
    confirmLabel: "초기화",
    danger: true,
    onConfirm: () => {
      const now = Date.now();
      state.seats.forEach((seat) => {
        if (seat.status === "away" || seat.status === "noshow") {
          seat.status = "away";
          seat.awayStartedAt = now;
        }
      });
      state.lastUpdated = now;
      saveState();
      renderDashboard();
      showToast("모든 자리 비움 타이머를 초기화했습니다.");
    },
  });
}

function showLimitModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal" id="limit-form" role="dialog" aria-modal="true" aria-labelledby="limit-title">
      <h2 id="limit-title">자리 비움 제한 시간 설정</h2>
      <p>관리자가 설정한 시간이 지나면 해당 좌석이 노쇼 상태로 전환됩니다.</p>
      <label class="field-label" for="limit-input">제한 시간 (1~180분)</label>
      <input class="input" id="limit-input" type="number" min="1" max="180" value="${state.noShowLimit}" required />
      <div class="modal-actions"><button type="button" class="btn btn-neutral" data-limit-cancel>취소</button><button type="submit" class="btn btn-primary">저장</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const input = backdrop.querySelector("#limit-input");
  input.focus();
  input.select();
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-limit-cancel]")) backdrop.remove();
  });
  backdrop.querySelector("#limit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      showToast("제한 시간은 1~180분 사이의 정수로 입력해 주세요.", "error");
      return;
    }
    state.noShowLimit = value;
    const threshold = value * 60 * 1000;
    state.seats.forEach((seat) => {
      if (seat.status === "away" && seat.awayStartedAt && Date.now() - seat.awayStartedAt >= threshold) seat.status = "noshow";
    });
    state.lastUpdated = Date.now();
    saveState();
    backdrop.remove();
    renderDashboard();
    showToast(`자리 비움 제한 시간을 ${value}분으로 설정했습니다.`);
  });
}

function newRoiState() {
  const savedConfig = state.detectionConfig || {};
  return {
    phase: 1,
    draftSeats: [],
    selectedUid: null,
    rectStart: null,
    rectCurrent: null,
    dragHandle: null,
    dragPolygon: null,
    activePointerId: null,
    confidence: Number(savedConfig.confidence) || 0.35,
    classPreset: ROI_CLASS_PRESETS[savedConfig.classPreset] ? savedConfig.classPreset : "library",
    dirty: false,
    labelError: "",
  };
}

function stepper() {
  const steps = ["카메라 확인", "화면 캡처", "좌석 영역 지정", "저장"];
  return `<div class="stepper" aria-label="좌석 영역 설정 단계">${steps
    .map((label, index) => {
      const number = index + 1;
      const css = number === roiState.phase ? "active" : number < roiState.phase ? "done" : "";
      const circle = number < roiState.phase ? icon("check") : number;
      return `${index ? `<div class="step-line ${number <= roiState.phase ? "done" : ""}"></div>` : ""}<div class="step ${css}"><span class="step-number">${circle}</span><span>${label}</span></div>`;
    })
    .join("")}</div>`;
}

function roiGuideText() {
  if (roiState.phase === 1) return "카메라 각도와 전체 좌석이 화면 안에 들어오는지 확인하세요.";
  if (roiState.phase === 2) return "움직임이 적고 좌석 경계가 가장 잘 보이는 순간에 화면을 캡처하세요.";
  if (roiState.phase === 3) return "빈 공간을 드래그해 ROI를 추가하세요. 영역 내부는 이동하고, 네 꼭짓점은 각각 변형할 수 있습니다.";
  return "새 좌석 배치를 저장하고 대시보드에 반영하고 있습니다.";
}

function renderRoi() {
  clearInterval(dashboardInterval);
  window.scrollTo(0, 0);
  if (!roiState) roiState = newRoiState();
  const isLive = roiState.phase <= 2;
  app.innerHTML = `
    <div class="app-shell">
      ${topbar("roi")}
      <main class="main-content roi-main">
        ${stepper()}
        <div class="roi-grid">
          <section class="roi-workspace">
            <div class="guide-banner">${icon("info")}<span>${escapeHtml(roiGuideText())}</span></div>
            <div class="camera-card ${isLive ? "is-live" : "is-captured"}" id="camera-card">
              <img src="assets/demo-library-camera.png" class="camera-image" alt="프로토타입용 도서관 카메라 장면" draggable="false" />
              <div class="camera-tint"></div>
              <div class="camera-hud">
                <span class="${isLive ? "live-pill" : "captured-pill"}">${isLive ? '<span class="live-dot"></span> LIVE · DEMO CAMERA' : `${icon("capture")} CAPTURED FRAME`}</span>
                <span class="camera-timestamp" id="camera-clock">${formatTime(Date.now())} KST</span>
              </div>
              ${roiState.phase === 2 ? '<div class="capture-overlay"><div class="capture-focus"></div></div>' : ""}
              ${roiState.phase === 3 ? `<canvas id="roi-canvas" class="roi-canvas" width="${VIEWBOX.width}" height="${Math.round(VIEWBOX.height)}" tabindex="0" aria-label="좌석 영역 편집 캔버스"></canvas>` : ""}
            </div>
          </section>
          <aside class="roi-sidebar" id="roi-sidebar">${roiSidebarMarkup()}</aside>
        </div>
      </main>
    </div>`;

  bindTopbar();
  bindRoiSidebar();
  if (roiState.phase === 3) {
    renderRoiCanvas();
    bindRoiCanvas();
  }
  const clock = document.getElementById("camera-clock");
  if (clock && isLive) {
    dashboardInterval = window.setInterval(() => {
      clock.textContent = `${formatTime(Date.now())} KST`;
    }, 1000);
  }
}

function roiSidebarMarkup() {
  if (roiState.phase === 1) {
    return `
      <div>
        <h2 class="sidebar-title">카메라 확인</h2>
        <p class="sidebar-description">좌석 영역을 설정하기 전 카메라 연결과 촬영 구도를 확인합니다.</p>
        <div class="camera-status-box"><span class="status-light"></span><div class="camera-status-copy"><strong>카메라가 연결되었습니다</strong><span>Demo Camera · 1920 × 1080 · 30 FPS</span></div></div>
        <ul class="check-list">
          <li><span class="check-mark">✓</span><span>모든 좌석의 책상과 의자가 화면 안에 보입니다.</span></li>
          <li><span class="check-mark">✓</span><span>좌석 사이 통로와 경계가 구분됩니다.</span></li>
          <li><span class="check-mark">✓</span><span>카메라가 고정되어 있고 영상이 선명합니다.</span></li>
        </ul>
      </div>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer"><button type="button" id="camera-ok" class="btn btn-primary btn-lg btn-block">카메라 확인 완료 ${icon("arrow")}</button><button type="button" id="roi-cancel" class="btn btn-ghost btn-block">대시보드로 돌아가기</button></div>`;
  }

  if (roiState.phase === 2) {
    return `
      <div>
        <h2 class="sidebar-title">화면 캡처</h2>
        <p class="sidebar-description">캡처한 한 장의 화면이 모든 좌석 ROI의 기준 좌표가 됩니다.</p>
        <div class="capture-preview"><strong>좋은 캡처 기준</strong><br />사람의 움직임이 적고, 좌석 모서리가 가려지지 않은 순간을 선택하세요. 프로토타입에서는 데모 장면이 사용됩니다.</div>
        <ul class="check-list"><li><span class="check-mark">1</span><span>왼쪽 실시간 화면에서 구도를 확인합니다.</span></li><li><span class="check-mark">2</span><span>아래 버튼을 눌러 현재 장면을 고정합니다.</span></li><li><span class="check-mark">3</span><span>고정 화면 위에서 좌석 영역을 설정합니다.</span></li></ul>
      </div>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer"><button type="button" id="capture-frame" class="btn btn-primary btn-lg btn-block">${icon("capture")}이 장면 캡처</button><button type="button" id="camera-back" class="btn btn-ghost btn-block">이전 단계</button></div>`;
  }

  if (roiState.phase === 4) {
    return `<div><h2 class="sidebar-title">설계 저장 중</h2><p class="sidebar-description">새 좌석 배치를 대시보드에 반영하고 있습니다.</p><div class="camera-status-box"><span class="status-light"></span><div class="camera-status-copy"><strong>${roiState.draftSeats.length}개 좌석 검증 완료</strong><span>배치 버전 ${state.layoutVersion + 1} 생성 중</span></div></div></div><div class="sidebar-spacer"></div>`;
  }

  const selected = selectedDraftSeat();
  return `
    <div>
      <h2 class="sidebar-title">좌석 영역 설정</h2>
      <p class="sidebar-description">빈 공간을 드래그하면 새 ROI가 생성됩니다.</p>
      <div class="roi-lab-toolbar">
        <button type="button" id="add-full-roi" class="btn btn-outline btn-sm">전체 화면 ROI</button>
        <span>프로토타입에서는 분석을 실행하지 않습니다.</span>
      </div>
      <section class="roi-settings-section" aria-labelledby="roi-area-heading">
        <div class="roi-section-heading">
          <div><span class="roi-section-number">1</span><h3 id="roi-area-heading">좌석 영역</h3></div>
          <span class="count-badge">${roiState.draftSeats.length}개</span>
        </div>
        <div class="roi-config-list">
          ${
            roiState.draftSeats.length
              ? roiState.draftSeats
                  .map((seat) => {
                    const bounds = bbox(seat.polygon);
                    const width = Math.round((bounds.x2 - bounds.x1) * 100);
                    const height = Math.round((bounds.y2 - bounds.y1) * 100);
                    return `<button type="button" class="roi-config-item ${seat.uid === roiState.selectedUid ? "selected" : ""}" data-select-seat="${escapeHtml(seat.uid)}"><span class="roi-config-name">${escapeHtml(seat.label)}</span><span class="roi-config-size">${seat.polygon.length}점 · ${width}% × ${height}%</span></button>`;
                  })
                  .join("")
              : '<p class="roi-config-empty">아직 설정된 ROI가 없습니다.</p>'
          }
        </div>
      ${
        selected
          ? `<div class="selected-editor roi-name-editor">
              <label class="field-label" for="seat-label-input">선택 영역 이름</label>
              <div class="roi-name-input-row"><input id="seat-label-input" class="input" value="${escapeHtml(selected.label)}" maxlength="30" aria-describedby="seat-name-hint seat-label-error" /><button type="button" id="delete-selected" class="mini-action danger" aria-label="선택 영역 삭제" title="삭제">${icon("trash")}</button></div>
              <p id="seat-name-hint" class="field-hint">대시보드 배치를 위해 테이블-행-열 형식으로 입력하세요. 예: T01-A-01</p>
              <p id="seat-label-error" class="field-error">${escapeHtml(roiState.labelError)}</p>
            </div>`
          : ""
      }
        <button type="button" id="clear-rois" class="btn btn-danger btn-sm" ${roiState.draftSeats.length ? "" : "disabled"}>모든 ROI 초기화</button>
      </section>
      <section class="roi-settings-section" aria-labelledby="roi-detection-heading">
        <div class="roi-section-heading"><div><span class="roi-section-number">2</span><h3 id="roi-detection-heading">탐지 설정</h3></div></div>
        <label class="field-label" for="roi-confidence">신뢰도 임계값 <output id="roi-confidence-value" for="roi-confidence">${roiState.confidence.toFixed(2)}</output></label>
        <input id="roi-confidence" class="roi-range-input" type="range" min="0.1" max="0.9" step="0.05" value="${roiState.confidence}" />
        <label class="field-label" for="roi-class-preset">탐지 클래스</label>
        <select id="roi-class-preset" class="input roi-select-input">
          <option value="library" ${roiState.classPreset === "library" ? "selected" : ""}>도서관 권장 클래스</option>
          <option value="person" ${roiState.classPreset === "person" ? "selected" : ""}>사람만</option>
          <option value="all" ${roiState.classPreset === "all" ? "selected" : ""}>COCO 전체 80종</option>
        </select>
        <p id="roi-class-note" class="field-hint">${escapeHtml(ROI_CLASS_NOTES[roiState.classPreset])}</p>
      </section>
    </div>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-footer"><button type="button" id="save-layout" class="btn btn-primary btn-lg btn-block">${icon("save")}좌석 배치 저장</button><button type="button" id="retake-frame" class="btn btn-neutral btn-block">${icon("capture")}장면 다시 캡처</button><button type="button" id="roi-cancel" class="btn btn-ghost btn-block">변경 취소</button></div>`;
}

function renderRoiSidebar() {
  const sidebar = document.getElementById("roi-sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = roiSidebarMarkup();
  const banner = document.querySelector(".guide-banner span");
  if (banner) banner.textContent = roiGuideText();
  bindRoiSidebar();
}

function bindRoiSidebar() {
  document.getElementById("camera-ok")?.addEventListener("click", () => {
    roiState.phase = 2;
    renderRoi();
  });
  document.getElementById("camera-back")?.addEventListener("click", () => {
    roiState.phase = 1;
    renderRoi();
  });
  document.getElementById("capture-frame")?.addEventListener("click", () => {
    roiState.phase = 3;
    renderRoi();
    showToast("장면을 캡처했습니다. 이제 좌석 영역을 편집할 수 있습니다.");
  });
  document.getElementById("retake-frame")?.addEventListener("click", () => {
    if (roiState.dirty) {
      showConfirm({
        title: "장면을 다시 캡처할까요?",
        message: "현재 편집 중인 좌석 영역은 저장 전 상태로 돌아갑니다.",
        confirmLabel: "다시 캡처",
        danger: true,
        onConfirm: () => {
          roiState = newRoiState();
          roiState.phase = 2;
          renderRoi();
        },
      });
    } else {
      roiState.phase = 2;
      renderRoi();
    }
  });
  document.getElementById("roi-cancel")?.addEventListener("click", () => {
    if (roiState.dirty) {
      showConfirm({
        title: "변경을 취소할까요?",
        message: "저장하지 않은 좌석 영역 변경사항은 사라집니다.",
        confirmLabel: "변경 취소",
        danger: true,
        onConfirm: () => {
          roiState = null;
          navigate("dashboard");
        },
      });
    } else {
      roiState = null;
      navigate("dashboard");
    }
  });
  document.getElementById("add-full-roi")?.addEventListener("click", () => addDraftSeat(makeRect(0, 0, 1, 1)));
  document.getElementById("delete-selected")?.addEventListener("click", () => deleteDraftSeat(roiState.selectedUid));
  document.getElementById("clear-rois")?.addEventListener("click", () => {
    if (!roiState.draftSeats.length) return;
    roiState.draftSeats = [];
    roiState.selectedUid = null;
    roiState.labelError = "";
    roiState.dirty = true;
    renderRoiCanvas();
    renderRoiSidebar();
    showToast("모든 ROI를 초기화했습니다.");
  });
  document.querySelectorAll("[data-select-seat]").forEach((row) => {
    const select = () => {
      roiState.selectedUid = row.dataset.selectSeat;
      roiState.labelError = "";
      renderRoiCanvas();
      renderRoiSidebar();
    };
    row.addEventListener("click", select);
  });
  document.getElementById("seat-label-input")?.addEventListener("input", (event) => {
    const seat = selectedDraftSeat();
    if (!seat) return;
    const value = event.currentTarget.value.trimStart().slice(0, 30);
    const parts = value.split("-").map((part) => part.trim());
    seat.label = value;
    seat.table = parts[0] || "";
    seat.row = parts[1] || "";
    seat.column = parts.length === 3 ? parts[2] : "";
    roiState.dirty = true;
    roiState.labelError = validateLabel(seat);
    document.getElementById("seat-label-error").textContent = roiState.labelError;
    renderRoiCanvas();
    const rowLabel = document.querySelector(`[data-select-seat="${CSS.escape(seat.uid)}"] .roi-config-name`);
    if (rowLabel) rowLabel.textContent = seat.label || "이름 없음";
  });
  document.getElementById("roi-confidence")?.addEventListener("input", (event) => {
    roiState.confidence = Number(event.currentTarget.value);
    roiState.dirty = true;
    const output = document.getElementById("roi-confidence-value");
    if (output) output.textContent = roiState.confidence.toFixed(2);
  });
  document.getElementById("roi-class-preset")?.addEventListener("change", (event) => {
    roiState.classPreset = ROI_CLASS_PRESETS[event.currentTarget.value] ? event.currentTarget.value : "library";
    roiState.dirty = true;
    const note = document.getElementById("roi-class-note");
    if (note) note.textContent = ROI_CLASS_NOTES[roiState.classPreset];
  });
  document.getElementById("save-layout")?.addEventListener("click", requestLayoutSave);
}

function selectedDraftSeat() {
  return roiState?.draftSeats.find((seat) => seat.uid === roiState.selectedUid) || null;
}

function validateLabel(seat) {
  const label = String(seat.label || "").trim();
  const parts = label.split("-").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => !part)) return "T01-A-01처럼 테이블-행-열 형식으로 입력해 주세요.";
  if (roiState.draftSeats.some((item) => item.uid !== seat.uid && String(item.label).trim().toLowerCase() === label.toLowerCase())) return "이미 사용 중인 좌석 이름입니다.";
  return "";
}

function deleteDraftSeat(uid) {
  const seat = roiState.draftSeats.find((item) => item.uid === uid);
  if (!seat) return;
  roiState.draftSeats = roiState.draftSeats.filter((item) => item.uid !== uid);
  roiState.selectedUid = roiState.draftSeats.at(-1)?.uid || null;
  roiState.dirty = true;
  roiState.labelError = "";
  renderRoiCanvas();
  renderRoiSidebar();
  showToast(`${seat.label} ROI를 삭제했습니다.`);
}

function roiSeatsInPaintOrder() {
  return roiState.draftSeats;
}

function roiCanvasPoints(polygon) {
  return polygon.map(([x, y]) => [x * VIEWBOX.width, y * VIEWBOX.height]);
}

function traceRoiPolygon(context, points) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
}

function drawRoiCanvasShape(context, canvas, polygon, label, selected) {
  const points = roiCanvasPoints(polygon);
  const bounds = bbox(polygon);
  const scale = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
  const color = selected ? "#2d8fce" : "#08a877";

  context.save();
  traceRoiPolygon(context, points);
  context.fillStyle = selected ? "rgba(45, 143, 206, 0.22)" : "rgba(8, 168, 119, 0.18)";
  context.strokeStyle = color;
  context.lineWidth = Math.max(2, 2 * scale);
  context.setLineDash(selected ? [] : [7 * scale, 4 * scale]);
  context.fill();
  context.stroke();
  context.setLineDash([]);

  const x = bounds.x1 * VIEWBOX.width;
  const y = bounds.y1 * VIEWBOX.height;
  const fontSize = Math.max(12, 13 * scale);
  const labelHeight = 24 * scale;
  const labelY = y >= labelHeight ? y - labelHeight : y;
  context.font = `700 ${fontSize}px "IBM Plex Sans KR", sans-serif`;
  const labelWidth = context.measureText(label).width + 14 * scale;
  context.fillStyle = color;
  context.fillRect(x, labelY, Math.min(labelWidth, canvas.width - x), labelHeight);
  context.fillStyle = "#ffffff";
  context.textBaseline = "middle";
  context.fillText(label, x + 7 * scale, labelY + labelHeight / 2, Math.max(1, canvas.width - x - 8 * scale));

  if (selected) {
    const handleRadius = 5.5 * scale;
    points.forEach(([handleX, handleY]) => {
      context.beginPath();
      context.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.strokeStyle = color;
      context.lineWidth = Math.max(2, 2 * scale);
      context.fill();
      context.stroke();
    });
  }
  context.restore();
}

function renderRoiCanvas() {
  const canvas = document.getElementById("roi-canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineJoin = "round";
  context.lineCap = "round";

  roiSeatsInPaintOrder().forEach((seat) => {
    drawRoiCanvasShape(context, canvas, seat.polygon, seat.label || "이름 없음", seat.uid === roiState.selectedUid);
  });

  if (roiState.rectStart && roiState.rectCurrent) {
    const preview = rectPreviewPoints(roiState.rectStart, roiState.rectCurrent).map(([x, y]) => [x / VIEWBOX.width, y / VIEWBOX.height]);
    drawRoiCanvasShape(context, canvas, preview, "새 영역", true);
  }
}

function bindRoiCanvas() {
  const canvas = document.getElementById("roi-canvas");
  if (!canvas) return;
  canvas.addEventListener("pointerdown", handleRoiPointerDown);
  canvas.addEventListener("pointermove", handleRoiPointerMove);
  canvas.addEventListener("pointerup", (event) => handleRoiPointerEnd(event, false));
  canvas.addEventListener("pointercancel", (event) => handleRoiPointerEnd(event, true));
  canvas.addEventListener("pointerleave", () => {
    if (roiState.activePointerId === null) setRoiCanvasCursor(canvas, null);
  });
}

function pointFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return [
    Math.max(0, Math.min(VIEWBOX.width, ((event.clientX - rect.left) / rect.width) * VIEWBOX.width)),
    Math.max(0, Math.min(VIEWBOX.height, ((event.clientY - rect.top) / rect.height) * VIEWBOX.height)),
  ];
}

function pointInRoiPolygon(point, polygon) {
  const [px, py] = point;
  const points = roiCanvasPoints(polygon);
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[previous];
    const crossesRay = (y1 > py) !== (y2 > py) && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function roiHandleAt(point) {
  const seat = selectedDraftSeat();
  if (!seat) return null;
  const points = roiCanvasPoints(seat.polygon);
  const index = points.findIndex(([x, y]) => Math.hypot(point[0] - x, point[1] - y) <= 13);
  return index >= 0 ? { uid: seat.uid, index } : null;
}

function roiSeatAt(point) {
  for (let index = roiState.draftSeats.length - 1; index >= 0; index -= 1) {
    const seat = roiState.draftSeats[index];
    if (pointInRoiPolygon(point, seat.polygon)) return seat;
  }
  return null;
}

function roiPolygonArea(points) {
  return Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function roiOrientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function roiPointOnSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-9 && b[0] >= Math.min(a[0], c[0]) - 1e-9
    && b[1] <= Math.max(a[1], c[1]) + 1e-9 && b[1] >= Math.min(a[1], c[1]) - 1e-9;
}

function roiSegmentsIntersect(a, b, c, d) {
  const o1 = roiOrientation(a, b, c);
  const o2 = roiOrientation(a, b, d);
  const o3 = roiOrientation(c, d, a);
  const o4 = roiOrientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && roiPointOnSegment(a, c, b)) return true;
  if (o2 === 0 && roiPointOnSegment(a, d, b)) return true;
  if (o3 === 0 && roiPointOnSegment(c, a, d)) return true;
  return o4 === 0 && roiPointOnSegment(c, b, d);
}

function isValidRoiPolygon(points) {
  if (points.length < 3 || roiPolygonArea(points) < 0.00004) return false;
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      const adjacent = first === second || firstNext === second || secondNext === first;
      if (!adjacent && roiSegmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return false;
    }
  }
  return true;
}

function setRoiCanvasCursor(canvas, hit) {
  canvas.classList.toggle("is-reshaping", hit === "handle");
  canvas.classList.toggle("is-moving", hit === "seat");
}

function handleRoiPointerDown(event) {
  if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || roiState.activePointerId !== null) return;
  event.preventDefault();
  const canvas = event.currentTarget;
  const point = pointFromEvent(event);
  const handle = roiHandleAt(point);
  if (handle) {
    const seat = roiState.draftSeats.find((item) => item.uid === handle.uid);
    roiState.dragHandle = {
      uid: handle.uid,
      index: handle.index,
      original: seat.polygon.map(([x, y]) => [x, y]),
      moved: false,
    };
    roiState.activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    setRoiCanvasCursor(canvas, "handle");
    return;
  }

  const hitSeat = roiSeatAt(point);
  const uid = hitSeat?.uid || null;
  roiState.selectedUid = uid;
  roiState.labelError = "";
  if (uid) {
    roiState.dragPolygon = {
      uid,
      start: point,
      original: hitSeat.polygon.map(([x, y]) => [x, y]),
      moved: false,
    };
    setRoiCanvasCursor(canvas, "seat");
  } else {
    roiState.rectStart = point;
    roiState.rectCurrent = point;
    setRoiCanvasCursor(canvas, null);
  }
  roiState.activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  renderRoiCanvas();
  renderRoiSidebar();
}

function handleRoiPointerMove(event) {
  const point = pointFromEvent(event);
  const canvas = event.currentTarget;

  if (roiState.activePointerId === null) {
    if (roiHandleAt(point)) setRoiCanvasCursor(canvas, "handle");
    else setRoiCanvasCursor(canvas, roiSeatAt(point) ? "seat" : null);
    return;
  }
  if (event.pointerId !== roiState.activePointerId) return;
  event.preventDefault();

  if (roiState.dragHandle) {
    const drag = roiState.dragHandle;
    const seat = roiState.draftSeats.find((item) => item.uid === drag.uid);
    if (seat) {
      const candidate = drag.original.map(([x, y]) => [x, y]);
      candidate[drag.index] = [point[0] / VIEWBOX.width, point[1] / VIEWBOX.height];
      if (isValidRoiPolygon(candidate)) {
        seat.polygon = candidate;
        drag.moved = true;
        roiState.dirty = true;
        renderRoiCanvas();
      }
    }
    return;
  }
  if (roiState.dragPolygon) {
    const drag = roiState.dragPolygon;
    const seat = roiState.draftSeats.find((item) => item.uid === drag.uid);
    if (seat) {
      const rawDx = (point[0] - drag.start[0]) / VIEWBOX.width;
      const rawDy = (point[1] - drag.start[1]) / VIEWBOX.height;
      const xs = drag.original.map(([x]) => x);
      const ys = drag.original.map(([, y]) => y);
      const dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), rawDx));
      const dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), rawDy));
      const distance = Math.hypot(dx * VIEWBOX.width, dy * VIEWBOX.height);

      if (!drag.moved && distance < 3) return;

      drag.moved = true;
      seat.polygon = drag.original.map(([x, y]) => [x + dx, y + dy]);
      roiState.dirty = true;
      renderRoiCanvas();
    }
    return;
  }
  if (roiState.rectStart) {
    roiState.rectCurrent = point;
    renderRoiCanvas();
  }
}

function handleRoiPointerEnd(event, cancelled) {
  if (event.pointerId !== roiState.activePointerId) return;
  const canvas = event.currentTarget;

  if (roiState.dragHandle) {
    if (cancelled) {
      const seat = roiState.draftSeats.find((item) => item.uid === roiState.dragHandle.uid);
      if (seat) seat.polygon = roiState.dragHandle.original;
    }
    roiState.dragHandle = null;
  } else if (roiState.dragPolygon) {
    if (cancelled) {
      const seat = roiState.draftSeats.find((item) => item.uid === roiState.dragPolygon.uid);
      if (seat) seat.polygon = roiState.dragPolygon.original;
    }
    roiState.dragPolygon = null;
  } else if (!cancelled && roiState.rectStart && roiState.rectCurrent) {
    const width = Math.abs(roiState.rectCurrent[0] - roiState.rectStart[0]);
    const height = Math.abs(roiState.rectCurrent[1] - roiState.rectStart[1]);
    const canvasRect = canvas.getBoundingClientRect();
    const minWidth = (8 / Math.max(canvasRect.width, 1)) * VIEWBOX.width;
    const minHeight = (8 / Math.max(canvasRect.height, 1)) * VIEWBOX.height;
    if (width < minWidth || height < minHeight) {
      roiState.rectStart = null;
      roiState.rectCurrent = null;
      roiState.activePointerId = null;
      try { canvas.releasePointerCapture(event.pointerId); } catch {}
      renderRoiCanvas();
      return;
    }
    const points = rectPreviewPoints(roiState.rectStart, roiState.rectCurrent).map(([x, y]) => [x / VIEWBOX.width, y / VIEWBOX.height]);
    roiState.activePointerId = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    addDraftSeat(points);
    return;
  } else if (cancelled) {
    roiState.rectStart = null;
    roiState.rectCurrent = null;
  }

  roiState.activePointerId = null;
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
  setRoiCanvasCursor(canvas, null);
  renderRoiCanvas();
}

function rectPreviewPoints(start, current) {
  const x1 = Math.min(start[0], current[0]);
  const x2 = Math.max(start[0], current[0]);
  const y1 = Math.min(start[1], current[1]);
  const y2 = Math.max(start[1], current[1]);
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

function nextSeatIdentity() {
  const used = new Set(roiState.draftSeats.map((seat) => formatSeatLabel(seat).toLowerCase()));
  let serial = 0;
  while (serial < 9999) {
    const identity = defaultSeatIdentity(serial);
    if (!used.has(formatSeatLabel(identity).toLowerCase())) return identity;
    serial += 1;
  }
  return { table: "T99", row: "Z", column: String(Date.now()).slice(-4) };
}

function newUid() {
  return globalThis.crypto?.randomUUID?.() || `seat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addDraftSeat(polygon) {
  const identity = nextSeatIdentity();
  const seat = {
    uid: newUid(),
    ...identity,
    label: formatSeatLabel(identity),
    polygon,
    planPosition: null,
    status: "empty",
    awayStartedAt: null,
  };
  const overlap = roiState.draftSeats.some((existing) => bboxOverlapRatio(existing.polygon, polygon) > 0.28);
  roiState.draftSeats.push(seat);
  roiState.selectedUid = seat.uid;
  roiState.rectStart = null;
  roiState.rectCurrent = null;
  roiState.dirty = true;
  renderRoiCanvas();
  renderRoiSidebar();
  showToast(overlap ? `${seat.label} 영역을 추가했습니다. 다른 좌석과 겹치는지 확인해 주세요.` : `${seat.label} 좌석 영역을 추가했습니다.`, overlap ? "error" : "success");
}

function bbox(polygon) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

function bboxOverlapRatio(aPolygon, bPolygon) {
  const a = bbox(aPolygon);
  const b = bbox(bPolygon);
  const width = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const height = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const overlap = width * height;
  const bArea = Math.max(0.0001, (b.x2 - b.x1) * (b.y2 - b.y1));
  return overlap / bArea;
}

function requestLayoutSave() {
  const invalid = roiState.draftSeats.find((seat) => validateLabel(seat));
  if (invalid) {
    roiState.selectedUid = invalid.uid;
    roiState.labelError = validateLabel(invalid);
    renderRoiCanvas();
    renderRoiSidebar();
    document.getElementById("seat-label-input")?.focus();
    showToast("좌석 ID를 확인해 주세요.", "error");
    return;
  }
  const message = roiState.draftSeats.length
    ? `${roiState.draftSeats.length}개 좌석을 테이블·행·열 기준으로 자동 정렬해 대시보드에 반영합니다. 수동 배치와 자리 비움 타이머는 초기화됩니다.`
    : "좌석이 없는 빈 배치로 저장합니다. 대시보드에는 좌석 추가 안내가 표시됩니다.";
  showConfirm({
    title: "새 좌석 배치를 저장할까요?",
    message,
    confirmLabel: "저장하고 적용",
    onConfirm: commitLayout,
  });
}

function commitLayout() {
  roiState.phase = 4;
  renderRoi();
  window.setTimeout(() => {
    const now = Date.now();
    const nextSeats = deepClone(roiState.draftSeats).map((seat) => ({
      ...seat,
      label: formatSeatLabel(seat),
      status: seat.status === "noshow" ? "away" : seat.status,
      awayStartedAt: seat.status === "away" || seat.status === "noshow" ? now : null,
    }));
    state.tablePositions = autoArrangePlan(nextSeats);
    state.seats = nextSeats;
    state.detectionConfig = {
      confidence: roiState.confidence,
      classPreset: roiState.classPreset,
      classes: ROI_CLASS_PRESETS[roiState.classPreset],
    };
    state.layoutVersion += 1;
    state.lastUpdated = now;
    saveState();
    roiState = null;
    navigate("dashboard");
    showToast("새 좌석 배치를 대시보드에 반영했습니다.");
  }, 650);
}

function renderRoute() {
  clearInterval(dashboardInterval);
  const route = currentRoute();
  if (!isAuthenticated() && route !== "login") {
    navigate("login");
    return;
  }
  if (route === "login") {
    renderLogin();
    return;
  }
  if (route === "roi") {
    renderRoi();
    return;
  }
  roiState = null;
  renderDashboard();
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("beforeunload", (event) => {
  if (currentRoute() === "roi" && roiState?.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

if (!location.hash) location.hash = "login";
else renderRoute();
