import { els } from "./elements.js";

const THEME_KEY = "bikeMapTheme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {
    /* ignore */
  }
  const icon = els.themeToggleBtn?.querySelector(".themeToggle__icon");
  if (els.themeToggleBtn) {
    els.themeToggleBtn.setAttribute(
      "aria-label",
      isDark ? "라이트 모드로 전환" : "다크 모드로 전환",
    );
  }
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
}

export function initTheme() {
  applyTheme(getStoredTheme());
  els.themeToggleBtn?.addEventListener("click", () => {
    applyTheme(getStoredTheme() === "dark" ? "light" : "dark");
  });
}
