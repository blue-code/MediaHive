const API_BASE = "/api";
const storage = window.localStorage;
const LIBRARY_STORAGE_KEY = "mediahiveLibraryId";
const SUPPORTED_MEDIA_KINDS = new Set(["directory", "video", "archive", "image"]);

const elements = {
  loginForm: document.getElementById("login-form"),
  authPanel: document.getElementById("auth"),
  gridContainer: document.querySelector(".grid"),
  tokenStatus: document.getElementById("token-status"),
  authPill: document.getElementById("auth-pill"),
  librarySelect: document.getElementById("library-select"),
  libraryPath: document.getElementById("library-path"),
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

let currentArchiveContext = null;

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

function clearLibraryView() {
  if (elements.librarySelect) {
    elements.librarySelect.innerHTML = "";
  }
  storage.removeItem(LIBRARY_STORAGE_KEY);
  if (elements.libraryInfo) {
    elements.libraryInfo.textContent = "로그인 후 라이브러리의 미디어가 자동으로 로드됩니다.";
  }
  if (elements.libraryGrid) {
    elements.libraryGrid.innerHTML = "<p class='muted'>라이브러리를 보려면 로그인하세요.</p>";
  }
}

function setToken(token, user) {
  if (token) {
    storage.setItem("mediahiveToken", token);
    storage.setItem("mediahiveUser", JSON.stringify(user));
  } else {
    storage.removeItem("mediahiveToken");
    storage.removeItem("mediahiveUser");
    clearLibraryView();
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
    elements.authPanel?.classList.add("hidden");
    elements.gridContainer?.classList.add("single-column");
  } else {
    elements.authPill.textContent = "로그인이 필요합니다";
    elements.tokenStatus.textContent = "토큰 없음";
    elements.tokenStatus.classList.remove("chip-flare");
    elements.authPanel?.classList.remove("hidden");
    elements.gridContainer?.classList.remove("single-column");
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
    if (response.status === 401) {
      setToken("", null);
    }
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

function buildMediaCard(item, onClick) {
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

  if (onClick) {
    card.addEventListener("click", () => onClick(item));
  }
  return card;
}

function renderMediaGrid(items = [], container, onClick, emptyMessage) {
  if (!container) return;
  container.innerHTML = "";
  const filtered = items.filter((item) => SUPPORTED_MEDIA_KINDS.has(item.mediaKind || item.type));
  if (!filtered.length) {
    container.innerHTML = `<p class='muted'>${emptyMessage || "표시할 항목이 없습니다."}</p>`;
    return;
  }

  filtered.forEach((item) => {
    const card = buildMediaCard(item, onClick);
    container.append(card);
  });
}

function renderLibraryItems(items = []) {
  renderMediaGrid(items, elements.libraryGrid, (item) => handleOpenItem(item));
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
  currentArchiveContext = null;
  elements.viewer.classList.add("hidden");
  elements.viewerContent.innerHTML = "";
}

function joinExtractedPath(root, relative) {
  return [root || "", relative || ""]
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/");
}

async function fetchArchiveListing({ scope = "library", archivePath, libraryId, subpath = "", root }) {
  const params = new URLSearchParams();
  if (scope === "extracted") {
    params.set("scope", "extracted");
  }
  params.set("path", archivePath);
  if (libraryId && scope === "library") {
    params.set("library", libraryId);
  }
  if (root && scope === "extracted") {
    params.set("root", root);
  }
  if (subpath) {
    params.set("subpath", subpath);
  }
  return api(`/library/archive/browse?${params.toString()}`);
}

function renderArchiveBreadcrumbs(context) {
  const trail = document.createElement("div");
  trail.className = "breadcrumbs";
  const rootButton = document.createElement("button");
  rootButton.className = "button ghost";
  rootButton.textContent = context.archiveName || "루트";
  rootButton.addEventListener("click", () => {
    loadArchivePath("", context);
  });
  trail.append(rootButton);

  let running = "";
  (context.breadcrumbs || []).forEach((segment) => {
    running = running ? `${running}/${segment}` : segment;
    const crumb = document.createElement("button");
    crumb.className = "button ghost";
    crumb.textContent = segment;
    crumb.addEventListener("click", () => {
      loadArchivePath(running, context);
    });
    trail.append(crumb);
  });

  return trail;
}

function renderArchiveBrowser(context) {
  currentArchiveContext = context;
  elements.viewerKind.textContent = "압축 탐색";
  elements.viewerTitle.textContent = context.archiveName || "압축 파일";
  const pathLabel = context.currentPath
    ? `${context.archivePath || ""} / ${context.currentPath}`
    : context.archivePath || "";
  elements.viewerPath.textContent = pathLabel;

  const wrapper = document.createElement("div");
  wrapper.className = "extracted-browser";
  wrapper.append(renderArchiveBreadcrumbs(context));

  const grid = document.createElement("div");
  grid.className = "media-grid";
  renderMediaGrid(
    context.items || [],
    grid,
    (item) => handleOpenExtractedItem(item, context),
    "압축을 풀었지만 표시할 항목이 없습니다.",
  );
  wrapper.append(grid);

  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(wrapper);
  openViewer();
}

async function loadArchivePath(subpath = "", context = currentArchiveContext) {
  if (!context) return;
  try {
    const data = await fetchArchiveListing({
      scope: context.scope || "library",
      archivePath: context.archivePath,
      libraryId: context.libraryId,
      subpath,
      root: context.scope === "extracted" ? context.archiveSourceRoot : undefined,
    });
    renderArchiveBrowser(data);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleArchive(item) {
  try {
    const data = await fetchArchiveListing({
      scope: "library",
      archivePath: item.path,
      libraryId: item.libraryId,
    });
    renderArchiveBrowser(data);
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderExtractedMedia(item, kind = "image") {
  elements.viewerKind.textContent = kind === "video" ? "비디오" : "이미지";
  elements.viewerTitle.textContent = item.name;
  elements.viewerPath.textContent = item.path || "";

  const wrapper = document.createElement("div");
  wrapper.className = "extracted-media";

  const actions = document.createElement("div");
  actions.className = "viewer-actions";
  const backButton = document.createElement("button");
  backButton.className = "button ghost";
  backButton.textContent = "목록으로";
  backButton.addEventListener("click", () => {
    if (currentArchiveContext) {
      renderArchiveBrowser(currentArchiveContext);
    } else {
      closeViewer();
    }
  });
  actions.append(backButton);

  if (kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.autoplay = true;
    video.src =
      item.streamPath ||
      (currentArchiveContext
        ? `/extracted/${joinExtractedPath(currentArchiveContext.extractedRoot, item.path)}`
        : "");
    video.addEventListener("canplay", () => {
      if (video.paused) {
        video.play().catch(() => {});
      }
    });
    wrapper.append(actions, video);
  } else {
    const img = document.createElement("img");
    img.src =
      item.streamPath ||
      (currentArchiveContext
        ? `/extracted/${joinExtractedPath(currentArchiveContext.extractedRoot, item.path)}`
        : "");
    img.alt = item.name;
    img.className = "viewer-image";
    wrapper.append(actions, img);
  }

  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(wrapper);
  openViewer();
}

function renderExtractedFile(item) {
  const href =
    item.streamPath ||
    (currentArchiveContext
      ? `/extracted/${joinExtractedPath(currentArchiveContext.extractedRoot, item.path)}`
      : "");
  if (href) {
    window.open(href, "_blank", "noopener");
  } else {
    toast("파일을 열 수 없습니다.", "error");
  }
}

async function handleOpenExtractedItem(item, context = currentArchiveContext) {
  const kind = item.mediaKind || item.type;
  if (!context) {
    toast("압축 탐색 정보를 찾을 수 없습니다.", "error");
    return;
  }

  if (kind === "directory") {
    await loadArchivePath(item.path, context);
    return;
  }

  if (kind === "archive") {
    try {
      const nested = await fetchArchiveListing({
        scope: "extracted",
        archivePath: item.path,
        root: context.extractedRoot,
      });
      renderArchiveBrowser(nested);
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }

  if (kind === "image") {
    renderExtractedMedia(item, "image");
    return;
  }

  if (kind === "video") {
    renderExtractedMedia(item, "video");
    return;
  }

  renderExtractedFile(item);
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
  currentArchiveContext = null;
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId) params.set("library", item.libraryId);
  params.set("ios", "true");
  const token = getToken();
  if (token) params.set("token", token);

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.autoplay = true;
  video.src = `/api/library/stream?${params.toString()}`;
  video.addEventListener("canplay", () => {
    if (video.paused) {
      video.play().catch(() => {});
    }
  });
  buildSubtitleTracks(video, item.subtitles || [], item.libraryId);

  elements.viewerKind.textContent = "비디오 스트리밍";
  elements.viewerTitle.textContent = item.name;
  elements.viewerPath.textContent = item.path;
  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(video);
  openViewer();
}

function handleDirectory(item) {
  currentArchiveContext = null;
  elements.libraryPath.value = item.path;
  browseLibrary();
}

function handleImage(item) {
  currentArchiveContext = null;
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId) params.set("library", item.libraryId);
  const token = getToken();
  if (token) params.set("token", token);
  const img = document.createElement("img");
  img.src = `/api/library/stream?${params.toString()}`;
  img.alt = item.name;
  img.className = "viewer-image";

  elements.viewerKind.textContent = "이미지";
  elements.viewerTitle.textContent = item.name;
  elements.viewerPath.textContent = item.path;
  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(img);
  openViewer();
}

function handleFile(item) {
  currentArchiveContext = null;
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId) params.set("library", item.libraryId);
  const token = getToken();
  if (token) params.set("token", token);
  const link = document.createElement("a");
  link.href = `/api/library/stream?${params.toString()}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

function handleOpenItem(item) {
  if (item.source === "extracted") {
    return handleOpenExtractedItem(item);
  }
  const kind = item.mediaKind || item.type;
  if (kind === "directory") return handleDirectory(item);
  if (kind === "video") return handleVideo(item);
  if (kind === "archive") return handleArchive(item);
  if (kind === "image") return handleImage(item);
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
  if (!getToken()) {
    clearLibraryView();
  }
  elements.loginForm.addEventListener("submit", handleLogin);
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
      browseLibrary();
    });
  }
  if (elements.libraryPath) {
    elements.libraryPath.addEventListener("change", browseLibrary);
    elements.libraryPath.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        browseLibrary();
      }
    });
  }
  if (getToken()) {
    browseLibrary();
  }
}

window.addEventListener("DOMContentLoaded", init);
