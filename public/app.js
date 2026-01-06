const API_BASE = "/api";
const storage = window.localStorage;
const LIBRARY_STORAGE_KEY = "mediahiveLibraryId";
const SUPPORTED_MEDIA_KINDS = new Set(["directory", "video", "archive", "image", "epub"]);

const elements = {
  loginForm: document.getElementById("login-form"),
  loginModal: document.getElementById("login-modal"),
  showLoginBtn: document.getElementById("show-login-btn"),
  loginClose: document.getElementById("login-close"),
  loginBackdrop: document.getElementById("login-backdrop"),
  authPill: document.getElementById("auth-pill"),
  librarySelect: document.getElementById("library-select"),
  libraryPath: document.getElementById("library-path"),
  libraryInfo: document.getElementById("library-info"),
  libraryGrid: document.getElementById("library-grid"),
  libraryPanel: document.getElementById("library"),
  publicLibraryPanel: document.getElementById("public-library"),
  publicLibraryInfo: document.getElementById("public-library-info"),
  publicLibraryGrid: document.getElementById("public-library-grid"),
  publicLibraryPath: document.getElementById("public-library-path"),
  toaster: document.getElementById("toaster"),
  viewer: document.getElementById("viewer"),
  viewerBackdrop: document.getElementById("viewer-backdrop"),
  viewerClose: document.getElementById("viewer-close"),
  viewerContent: document.getElementById("viewer-content"),
  viewerTitle: document.getElementById("viewer-title"),
  viewerKind: document.getElementById("viewer-kind"),
  viewerControls: document.getElementById("viewer-controls"),
};

let currentArchiveContext = null;
let currentImageIndex = 0;
let currentImageList = [];
let book = null;
let rendition = null;
let ttsAudio = new Audio();
let ttsSentences = [];
let currentSentenceIndex = -1;

function toast(message, variant = "info") {
  const div = document.createElement("div");
  div.className = `toast ${variant === "error" ? "error" : ""}`;
  div.innerHTML = message.replace(/\n/g, "<br>");
  elements.toaster.append(div);
  setTimeout(() => div.remove(), variant === "error" ? 8000 : 4000);
}

function getToken() { return storage.getItem("mediahiveToken") || ""; }

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
    elements.authPill.textContent = `${parsed.username}님`;
    elements.authPill.classList.remove("hidden");
    elements.showLoginBtn.classList.add("hidden");
    elements.libraryPanel.classList.remove("hidden");
  } else {
    elements.authPill.classList.add("hidden");
    elements.showLoginBtn.classList.remove("hidden");
    elements.libraryPanel.classList.add("hidden");
  }
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}), Accept: "application/json" };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) { headers.Authorization = `Bearer ${token}`; }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) { setToken("", null); }
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (_err) {}
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function renderMediaGrid(items = [], container, onClick, emptyMessage) {
  if (!container) return;
  container.innerHTML = "";
  const filtered = items.filter((item) => SUPPORTED_MEDIA_KINDS.has(item.mediaKind || item.type));
  if (!filtered.length) {
    container.innerHTML = `<p class='muted'>${emptyMessage || "표시할 항목이 없습니다."} </p>`;
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";
    const thumb = item.thumbnail || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300' fill='%23222'><rect width='200' height='300'/><text x='50%' y='50%' fill='%23555' text-anchor='middle'>NO THUMB</text></svg>";
    
    card.innerHTML = `
      <img class="thumb" src="${thumb}" alt="${item.name}" loading="lazy" />
      <div class="media-meta">
        <p class="media-title" title="${item.name}">${item.name}</p>
        <span class="badge">${item.mediaKind || item.type}</span>
      </div>
    `;
    card.addEventListener("click", () => onClick(item));
    container.append(card);
  });
}

async function browsePublicLibrary(path = "") {
  try {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const data = await api(`/public/library?${params.toString()}`);
    
    elements.publicLibraryInfo.textContent = `경로: ${data.currentPath || "/"}`;
    renderMediaGrid(
      (data.items || []).map(i => ({...i, isPublic: true})), 
      elements.publicLibraryGrid, 
      (item) => handleOpenItem(item)
    );
  } catch (err) {
    elements.publicLibraryGrid.innerHTML = `<p class='muted'>${err.message}</p>`;
    toast(err.message, "error");
  }
}

async function browseLibrary() {
  const token = getToken();
  if (!token) return;
  const path = elements.libraryPath.value.trim();
  const library = elements.librarySelect.value;
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (library) params.set("library", library);
  try {
    const data = await api(`/library/browse?${params.toString()}`);
    renderMediaGrid(data.items || [], elements.libraryGrid, (item) => handleOpenItem(item));
  } catch (err) {
    toast(err.message, "error");
  }
}

function handleEpub(item) {
  currentArchiveContext = null;
  const base = item.isPublic ? "/public/library" : "/library";
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId && !item.isPublic) params.set("library", item.libraryId);
  const url = `${API_BASE}${base.replace("/api", "")}/stream?${params.toString()}`;

  const storageKey = `epub_pos_${encodeURIComponent(item.path)}`;
  const savedCfi = storage.getItem(storageKey);

  elements.viewerKind.textContent = "eBook";
  elements.viewerTitle.textContent = item.name;
  elements.viewerContent.innerHTML = "<div id='epub-viewer' style='flex:1; background:#fff;'></div>";
  elements.viewerControls.innerHTML = `
    <button class="button ghost" id="epub-prev">이전</button>
    <button class="button primary" id="tts-play">TTS 시작</button>
    <button class="button ghost" id="epub-next">다음</button>
  `;
  
  document.getElementById("epub-prev").onclick = () => rendition?.prev();
  document.getElementById("epub-next").onclick = () => rendition?.next();
  document.getElementById("tts-play").onclick = () => toggleTTS();

  elements.viewer.classList.remove("hidden");

  if (window.ePub) {
    book = ePub(url);
    rendition = book.renderTo("epub-viewer", {
      width: "100%",
      height: "100%",
      flow: "paginated",
      manager: "default"
    });

    rendition.display(savedCfi).catch(() => rendition.display());

    rendition.on("relocated", (location) => {
      storage.setItem(storageKey, location.start.cfi);
    });
    
    // 텍스트 선택 시 TTS 중지
    rendition.on("selected", () => stopTTS());
  } else {
    toast("ePub 라이브러리를 로드하지 못했습니다.", "error");
  }
}

function handleVideo(item) {
  const base = item.isPublic ? "/api/public/library" : "/api/library";
  const params = new URLSearchParams();
  params.set("path", item.path);
  if (item.libraryId && !item.isPublic) params.set("library", item.libraryId);
  params.set("ios", "true");
  
  const video = document.createElement("video");
  video.controls = true;
  video.autoplay = true;
  video.style.width = "100%";
  video.style.height = "100%";
  video.src = `${base}/stream?${params.toString()}`;

  elements.viewerKind.textContent = "비디오";
  elements.viewerTitle.textContent = item.name;
  elements.viewerContent.innerHTML = "";
  elements.viewerContent.append(video);
  elements.viewerControls.innerHTML = "";
  elements.viewer.classList.remove("hidden");
}

function handleOpenItem(item) {
  const kind = item.mediaKind || item.type;
  if (kind === "directory") {
    if (item.isPublic) browsePublicLibrary(item.path);
    else browseLibrary();
    return;
  }
  if (kind === "epub") return handleEpub(item);
  if (kind === "video") return handleVideo(item);
  toast("지원하지 않는 형식입니다.", "error");
}

async function toggleTTS() {
  const btn = document.getElementById("tts-play");
  if (!ttsAudio.paused) {
    stopTTS();
    btn.textContent = "TTS 시작";
    return;
  }
  btn.textContent = "TTS 중지";
  startTTS();
}

function stopTTS() {
  ttsAudio.pause();
  ttsAudio.src = "";
  clearHighlight();
}

function clearHighlight() {
  const doc = rendition?.getContents()?.[0]?.document;
  if (!doc) return;
  doc.querySelectorAll(".tts-highlight").forEach(el => {
    el.style.backgroundColor = "transparent";
    el.classList.remove("tts-highlight");
  });
}

async function startTTS() {
  const content = rendition?.getContents()?.[0];
  if (!content) return;
  const doc = content.document;
  
  // 현재 페이지의 텍스트 추출 및 문장 단위 분리
  // ePub.js의 내부 iframe 문서를 직접 탐색
  const body = doc.body;
  const text = body.innerText;
  ttsSentences = text.split(/[.?!]\s+/).filter(s => s.trim().length > 0);
  currentSentenceIndex = 0;
  
  playNextSentence();
}

async function playNextSentence() {
  if (currentSentenceIndex >= ttsSentences.length) {
    // 현재 페이지 낭독 완료 -> 다음 페이지로
    rendition.next().then(() => {
      setTimeout(startTTS, 500); // 페이지 전환 대기 후 다시 시작
    });
    return;
  }

  const sentence = ttsSentences[currentSentenceIndex].trim();
  if (!sentence) {
    currentSentenceIndex++;
    playNextSentence();
    return;
  }

  // 문장 하이라이팅 (단순 텍스트 매칭 기반)
  highlightSentence(sentence);

  try {
    const response = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sentence })
    });
    
    if (!response.ok) throw new Error("TTS 생성 실패");
    
    const blob = await response.blob();
    ttsAudio.src = URL.createObjectURL(blob);
    ttsAudio.onended = () => {
      currentSentenceIndex++;
      playNextSentence();
    };
    ttsAudio.play();
  } catch (err) {
    console.error(err);
    toast("TTS 재생 중 오류가 발생했습니다.", "error");
    stopTTS();
  }
}

function highlightSentence(text) {
  const doc = rendition?.getContents()?.[0]?.document;
  if (!doc) return;
  clearHighlight();

  // 단순화된 하이라이팅 로직 (실제로는 더 정교한 DOM 탐색이 필요할 수 있음)
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes(text)) {
      const parent = node.parentElement;
      parent.classList.add("tts-highlight");
      parent.style.backgroundColor = "rgba(255, 255, 0, 0.4)"; // 노란색 음영
      parent.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }
  }
}

function closeViewer() {
  stopTTS();
  if (book) { book.destroy(); book = null; rendition = null; }
  elements.viewer.classList.add("hidden");
  elements.viewerContent.innerHTML = "";
}

function init() {
  paintAuthState();
  browsePublicLibrary();

  elements.showLoginBtn.onclick = () => elements.loginModal.classList.remove("hidden");
  elements.loginClose.onclick = () => elements.loginModal.classList.add("hidden");
  elements.loginBackdrop.onclick = () => elements.loginModal.classList.add("hidden");

  elements.loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify(payload) });
      setToken(data.token, data.user);
      elements.loginModal.classList.add("hidden");
      browseLibrary();
    } catch (err) { toast(err.message, "error"); }
  };

  elements.viewerClose.onclick = closeViewer;
  elements.viewerBackdrop.onclick = closeViewer;
  
  elements.publicLibraryPath.onchange = (e) => browsePublicLibrary(e.target.value);
}

window.addEventListener("DOMContentLoaded", init);