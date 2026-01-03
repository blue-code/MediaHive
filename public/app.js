const API_BASE = "/api";
const storage = window.localStorage;
const LIBRARY_STORAGE_KEY = "mediahiveLibraryId";

const elements = {
  loginForm: document.getElementById("login-form"),
  tokenStatus: document.getElementById("token-status"),
  authPill: document.getElementById("auth-pill"),
  librarySelect: document.getElementById("library-select"),
  libraryPath: document.getElementById("library-path"),
  browseButton: document.getElementById("browse"),
  libraryInfo: document.getElementById("library-info"),
  libraryGrid: document.getElementById("library-grid"),
  toaster: document.getElementById("toaster"),
  viewer: document.getElementById("viewer"),
  viewerBackdrop: document.getElementById("viewer-backdrop"),
  viewerClose: document.getElementById("viewer-close"),
  viewerContent: document.getElementById("viewer-content"),
  viewerTitle: document.getElementById("viewer-title"),
  viewerKind: document.getElementById("viewer-kind"),
  viewerPath: document.getElementById("viewer-path"),
};

function toast(message, variant = "info") {
  const div = document.createElement("div");
  div.className = `toast ${variant === "error" ? "error" : ""}`;
  div.textContent = message;
  elements.toaster.append(div);
  setTimeout(() => div.remove(), 4000);
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
  const parsed = user ? JSON.parse(user) : null;
  if (token && parsed) {
    elements.authPill.textContent = `${parsed.username}로 로그인됨`;
    elements.tokenStatus.textContent = "토큰 활성";
    elements.tokenStatus.classList.add("chip-flare");
  } else {
    elements.authPill.textContent = "로그인이 필요합니다";
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

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (_err) {
      // ignore
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
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

function cardThumbnail(item) {
  if (item.thumbnail) return item.thumbnail;
  if (item.mediaKind === "directory") return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='none' stroke='%23ffffff55'><rect x='40' y='70' width='320' height='180' rx='20' ry='20' stroke-width='10'/><path d='M80 110h240' stroke-width='10'/></svg>";
  return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='none' stroke='%23ffffff55'><rect x='90' y='40' width='220' height='220' rx='30' ry='30' stroke-width='12'/></svg>";
}

function renderLibraryItems(items = []) {
  elements.libraryGrid.innerHTML = "";
  if (!items.length) {
    elements.libraryGrid.innerHTML = "<p class='muted'>표시할 항목이 없습니다.</p>";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";
    card.dataset.path = item.path;
    card.dataset.library = item.libraryId;
    card.dataset.kind = item.mediaKind || item.type;

    card.innerHTML = `
      <img class="thumb" src="${cardThumbnail(item)}" alt="${item.name}" loading="lazy" />
      <div class="media-meta">
        <p class="media-title">${item.name}</p>
        <span class="badge">${item.mediaKind || item.type}</span>
      </div>
    `;

    card.addEventListener("click", () => handleOpenItem(item));
    elements.libraryGrid.append(card);
  });
}

async function browseLibrary() {
  const token = getToken();
  if (!token) {
    toast("로그인 후 라이브러리를 불러올 수 있습니다.", "error");
    return;
  }
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
    renderLibraryItems(data.items || []);
    toast("라이브러리를 불러왔습니다.");
  } catch (err) {
    elements.libraryGrid.innerHTML = `<p class='muted'>${err.message}</p>`;
    toast(err.message, "error");
  }
}

function openViewer() {
  elements.viewer.classList.remove("hidden");
}

function closeViewer() {
  elements.viewer.classList.add("hidden");
  elements.viewerContent.innerHTML = "";
}

async function handleArchive(item) {
  try {
    const params = new URLSearchParams();
    params.set("path", item.path);
    if (item.libraryId) params.set("library", item.libraryId);
    const data = await api(`/library/archive/pages?${params.toString()}`);
    elements.viewerKind.textContent = "압축 만화";
    elements.viewerTitle.textContent = item.name;
    elements.viewerPath.textContent = item.path;

    const list = document.createElement("div");
    list.className = "page-list";
    data.pages.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = item.name;
      list.append(img);
    });
    elements.viewerContent.innerHTML = "";
    elements.viewerContent.append(list);
    openViewer();
  } catch (err) {
    toast(err.message, "error");
  }
}

function buildSubtitleTracks(videoEl, subtitles = [], libraryId) {
  subtitles.forEach((sub) => {
    const url = `/api/library/stream?path=${encodeURIComponent(sub)}${
      libraryId ? `&library=${encodeURIComponent(libraryId)}` : ""
    }`;
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.src = url;
    track.srclang = "ko";
    track.label = "자막";
    videoEl.append(track);
  });
}

function handleVideo(item) {
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId) params.set("library", item.libraryId);
  params.set("ios", "true");

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.src = `/api/library/stream?${params.toString()}`;
  buildSubtitleTracks(video, item.subtitles || [], item.libraryId);

  elements.viewerKind.textContent = "비디오 스트리밍";
  elements.viewerTitle.textContent = item.name;
  elements.viewerPath.textContent = item.path;
  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(video);
  openViewer();
}

function handleDirectory(item) {
  elements.libraryPath.value = item.path;
  browseLibrary();
}

function handleFile(item) {
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId) params.set("library", item.libraryId);
  const link = document.createElement("a");
  link.href = `/api/library/stream?${params.toString()}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

function handleOpenItem(item) {
  const kind = item.mediaKind || item.type;
  if (kind === "directory") return handleDirectory(item);
  if (kind === "video") return handleVideo(item);
  if (kind === "archive") return handleArchive(item);
  return handleFile(item);
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
    toast(`${data.user.username}님 환영합니다.`);
    browseLibrary();
  } catch (err) {
    toast(err.message, "error");
  }
}

function init() {
  paintAuthState();
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.browseButton.addEventListener("click", browseLibrary);
  elements.viewerClose.addEventListener("click", closeViewer);
  elements.viewerBackdrop.addEventListener("click", closeViewer);
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
  if (getToken()) {
    browseLibrary();
  }
}

window.addEventListener("DOMContentLoaded", init);
