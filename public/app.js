const API_BASE = "/api";
const storage = window.localStorage;

const elements = {
  authView: document.getElementById("auth-view"),
  libraryView: document.getElementById("library-view"),
  loginForm: document.getElementById("login-form"),
  logoutButton: document.getElementById("logout-button"),
  rootButton: document.getElementById("root-button"),
  upButton: document.getElementById("up-button"),
  libraryList: document.getElementById("library-list"),
  currentPath: document.getElementById("current-path"),
  message: document.getElementById("message"),
  toast: document.getElementById("toast"),
};

const state = {
  currentPath: "",
};

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2500);
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
}

function showAuth() {
  elements.authView.classList.remove("hidden");
  elements.libraryView.classList.add("hidden");
}

function showLibrary() {
  elements.authView.classList.add("hidden");
  elements.libraryView.classList.remove("hidden");
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
    } catch (_err) {
      // ignore
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
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
    showLibrary();
    loadLibrary("");
  } catch (err) {
    toast(err.message);
  }
}

function logout() {
  setToken("", null);
  state.currentPath = "";
  elements.libraryList.innerHTML = "";
  elements.message.textContent = "";
  showAuth();
}

function parentPath(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function renderItems(items) {
  if (!items.length) {
    elements.libraryList.innerHTML = "";
    elements.message.textContent = "내용이 없습니다.";
    return;
  }

  const fragments = document.createDocumentFragment();
  items
    .slice()
    .sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    })
    .forEach((item) => {
      const div = document.createElement("div");
      div.className = "item";
      const kind = item.type === "directory" ? "폴더" : "파일";
      div.innerHTML = `
        <div class="name">${item.name}</div>
        <div class="meta">${kind}</div>
      `;
      if (item.type === "directory") {
        const button = document.createElement("button");
        button.className = "ghost";
        button.textContent = "열기";
        button.dataset.path = item.path;
        button.dataset.type = "directory";
        div.append(button);
      }
      fragments.append(div);
    });

  elements.libraryList.innerHTML = "";
  elements.libraryList.append(fragments);
  elements.message.textContent = "";
}

async function loadLibrary(targetPath = state.currentPath) {
  elements.message.textContent = "불러오는 중...";
  try {
    const data = await api(`/library/browse${targetPath ? `?path=${encodeURIComponent(targetPath)}` : ""}`);
    state.currentPath = data.currentPath || "";
    elements.currentPath.textContent = state.currentPath || ".";
    renderItems(data.items || []);
  } catch (err) {
    if (err.status === 401) {
      logout();
    }
    elements.message.textContent = err.message;
    toast(err.message);
  }
}

function handleLibraryClick(event) {
  const button = event.target.closest("button");
  if (!button || button.dataset.type !== "directory") return;
  loadLibrary(button.dataset.path || "");
}

function init() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", logout);
  elements.rootButton.addEventListener("click", () => loadLibrary(""));
  elements.upButton.addEventListener("click", () => loadLibrary(parentPath(state.currentPath)));
  elements.libraryList.addEventListener("click", handleLibraryClick);

  if (getToken()) {
    showLibrary();
    loadLibrary("");
  } else {
    showAuth();
  }
}

window.addEventListener("DOMContentLoaded", init);
