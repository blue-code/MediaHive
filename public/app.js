const API_BASE = "/api";
const storage = window.localStorage;
const LIBRARY_STORAGE_KEY = "mediahiveLibraryId";

const elements = {
  authPill: document.getElementById("auth-pill"),
  tokenStatus: document.getElementById("token-status"),
  statContent: document.getElementById("stat-content"),
  statLinked: document.getElementById("stat-linked"),
  statReady: document.getElementById("stat-ready"),
  contentGrid: document.getElementById("content-grid"),
  refresh: document.getElementById("refresh"),
  uploadForm: document.getElementById("upload-form"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  toaster: document.getElementById("toaster"),
  lastUpdated: document.getElementById("last-updated"),
  libraryPath: document.getElementById("library-path"),
  libraryList: document.getElementById("library-list"),
  librarySelect: document.getElementById("library-select"),
  libraryInfo: document.getElementById("library-info"),
  browseButton: document.getElementById("browse"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
};

function toast(message, variant = "info") {
  const div = document.createElement("div");
  div.className = `toast ${variant === "error" ? "error" : ""}`;
  div.textContent = message;
  elements.toaster.append(div);
  setTimeout(() => div.remove(), 4200);
}

function getToken() {
  return storage.getItem("mediahiveToken") || "";
}

function setToken(token, user) {
  if (token) {
    storage.setItem("mediahiveToken", token);
    storage.setItem("mediahiveUser", JSON.stringify(user));
  } else {
    storage.removeItem("mediahiveToken");
    storage.removeItem("mediahiveUser");
  }
  paintAuthState();
}

function paintAuthState() {
  const token = getToken();
  const user = storage.getItem("mediahiveUser");
  const parsedUser = user ? JSON.parse(user) : null;
  if (token && parsedUser) {
    elements.authPill.textContent = `${parsedUser.username}로 로그인됨`;
    elements.tokenStatus.textContent = "토큰 활성";
    elements.tokenStatus.classList.add("chip-flare");
  } else {
    elements.authPill.textContent = "게스트 모드 · 로그인하면 모든 기능 사용 가능";
    elements.tokenStatus.textContent = "토큰 없음";
    elements.tokenStatus.classList.remove("chip-flare");
  }
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}), Accept: "application/json" };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (err) {
      // ignore parse error
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function updateStats(items = []) {
  const linked = items.filter((i) => i.url).length;
  const ready = items.filter((i) => i.navigation && i.navigation.readingMode).length;
  elements.statContent.textContent = items.length;
  elements.statLinked.textContent = linked;
  elements.statReady.textContent = ready;
}

function readingModeLabel(item) {
  if (!item.navigation.readingMode) return "모드 선택 필요";
  return item.navigation.readingMode.replace("archive-", "archive → ");
}

function contentAccent(type = "") {
  if (type.includes("webtoon")) return "var(--accent-2)";
  if (type.includes("archive")) return "var(--accent-3)";
  if (type.includes("video")) return "var(--accent)";
  return "#fff";
}

function selectedLibraryId() {
  return (
    (elements.librarySelect && elements.librarySelect.value) ||
    storage.getItem(LIBRARY_STORAGE_KEY) ||
    ""
  );
}

function setLibraryOptions(roots = [], activeId = "") {
  if (!elements.librarySelect) return;
  const fallbackId = storage.getItem(LIBRARY_STORAGE_KEY) || "";
  const defaultId = activeId || elements.librarySelect.value || fallbackId || roots[0]?.id || "";

  elements.librarySelect.innerHTML = "";
  roots.forEach((root, index) => {
    const option = document.createElement("option");
    option.value = root.id;
    option.textContent = root.name;
    if (root.id === defaultId || (!defaultId && index === 0)) {
      option.selected = true;
    }
    elements.librarySelect.append(option);
  });

  const selected = elements.librarySelect.value || defaultId;
  if (selected) {
    storage.setItem(LIBRARY_STORAGE_KEY, selected);
  } else {
    storage.removeItem(LIBRARY_STORAGE_KEY);
  }
}

function renderLibraryInfo(libraryRoot, currentPath) {
  if (!elements.libraryInfo) return;
  if (!libraryRoot) {
    elements.libraryInfo.textContent = "라이브러리가 설정되지 않았습니다.";
    return;
  }
  const label = currentPath ? currentPath || "." : ".";
  elements.libraryInfo.textContent = `${libraryRoot.name} (${libraryRoot.path}) · 현재 경로: ${label}`;
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "content-card";
  const accent = contentAccent(item.type.toLowerCase());

  card.innerHTML = `
    <div class="meta">
      <div class="title-row">
        <div>
          <div class="badge" style="border-color:${accent};color:${accent}">${item.type}</div>
          <h3>${item.title}</h3>
        </div>
        <div class="chip" style="color:${accent};border-color:${accent};">${readingModeLabel(item)}</div>
      </div>
      <p class="description">${item.description || "아직 설명이 없습니다"}</p>
      ${item.url ? `<a class="button ghost" href="${item.url}" target="_blank">파일 열기</a>` : ""}
      <div class="card-actions">
        <select class="mode-select" data-id="${item.id}">
          <option value="">자동</option>
          <option value="paged">paged</option>
          <option value="webtoon">webtoon</option>
          <option value="archive-comic">archive-comic</option>
          <option value="archive-webtoon">archive-webtoon</option>
        </select>
        <button class="button ghost" data-action="apply" data-id="${item.id}">모드 설정</button>
        <button class="button" data-action="delete" data-id="${item.id}">삭제</button>
      </div>
    </div>`;

  const modeSelect = card.querySelector(".mode-select");
  if (item.navigation.readingMode) {
    modeSelect.value = item.navigation.readingMode;
  }
  modeSelect.dataset.type = item.type;
  return card;
}

async function loadContent() {
  elements.contentGrid.innerHTML = "<p class='muted'>카탈로그를 불러오는 중…</p>";
  try {
    const data = await api("/content");
    const items = data.items || [];
    elements.contentGrid.innerHTML = "";
    items.forEach((item) => elements.contentGrid.append(createCard(item)));
    updateStats(items);
    elements.lastUpdated.textContent = `${new Date().toLocaleTimeString()}에 업데이트`;
  } catch (err) {
    elements.contentGrid.innerHTML = `<p class='muted'>${err.message}</p>`;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.token, data.user);
    toast(`${data.user.username}님, 다시 오신 것을 환영합니다`);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.token, data.user);
    toast(`${data.user.username} 계정을 만들었습니다`);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleUpload(event) {
  event.preventDefault();
  const token = getToken();
  if (!token) {
    toast("업로드하려면 먼저 로그인하세요", "error");
    return;
  }

  const formData = new FormData(elements.uploadForm);
  try {
    await api("/content/upload", {
      method: "POST",
      body: formData,
    });
    toast("업로드 완료. 카탈로그를 새로고침했습니다.");
    elements.uploadForm.reset();
    await loadContent();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleContentAction(event) {
  const target = event.target.closest("button");
  if (!target) return;
  const id = target.dataset.id;
  if (!id) return;
  const action = target.dataset.action;

  if (action === "delete") {
    if (!confirm("이 항목을 삭제할까요?")) return;
    try {
      await api(`/content/${id}`, { method: "DELETE" });
      toast("항목을 삭제했습니다");
      await loadContent();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (action === "apply") {
    const card = target.closest(".content-card");
    const select = card.querySelector(".mode-select");
    const mode = select.value;
    if (!mode) {
      toast("먼저 읽기 모드를 선택하세요", "error");
      return;
    }
    try {
      await api(`/content/${id}/navigation`, {
        method: "PATCH",
        body: JSON.stringify({ readingMode: mode }),
      });
      toast("읽기 모드를 업데이트했습니다");
      await loadContent();
    } catch (err) {
      toast(err.message, "error");
    }
  }
}

async function browseLibrary() {
  const path = elements.libraryPath.value.trim();
  const library = selectedLibraryId();
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (library) params.set("library", library);
  try {
    const query = params.toString();
    const data = await api(`/library/browse${query ? `?${query}` : ""}`);
    setLibraryOptions(data.libraryRoots || [], data.libraryRoot?.id);
    renderLibraryInfo(data.libraryRoot, data.currentPath);
    elements.libraryList.innerHTML = "";
    const items = data.items || [];
    if (!items.length) {
      elements.libraryList.innerHTML = "<p class='muted'>항목이 없습니다.</p>";
    }
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = "library-item";
      div.innerHTML = `
        <div class="path">${item.name}</div>
        <div class="muted">${item.type} · ${item.size}</div>
      `;
      elements.libraryList.append(div);
    });
    toast("라이브러리를 업데이트했습니다");
  } catch (err) {
    elements.libraryList.innerHTML = `<p class='muted'>${err.message}</p>`;
    toast(err.message, "error");
  }
}

function enableDropzone() {
  elements.dropzone.addEventListener("click", () => elements.fileInput.click());
  ["dragenter", "dragover"].forEach((evt) =>
    elements.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      elements.dropzone.style.borderColor = "var(--accent)";
    }),
  );
  ["dragleave", "drop"].forEach((evt) =>
    elements.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      elements.dropzone.style.borderColor = "rgba(255,255,255,0.2)";
    }),
  );
  elements.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) {
      elements.fileInput.files = event.dataTransfer.files;
    }
  });
}

function wireScrollButtons() {
  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.scroll;
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function init() {
  paintAuthState();
  loadContent();
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.uploadForm.addEventListener("submit", handleUpload);
  elements.refresh.addEventListener("click", loadContent);
  elements.contentGrid.addEventListener("click", handleContentAction);
  elements.browseButton.addEventListener("click", browseLibrary);
  enableDropzone();
  wireScrollButtons();
  if (elements.librarySelect) {
    elements.librarySelect.addEventListener("change", () => {
      const selected = elements.librarySelect.value;
      if (selected) {
        storage.setItem(LIBRARY_STORAGE_KEY, selected);
      } else {
        storage.removeItem(LIBRARY_STORAGE_KEY);
      }
    });
  }
  browseLibrary();
}

window.addEventListener("DOMContentLoaded", init);
