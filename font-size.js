(() => {
  const key = "rong-menu-font-size";
  const allowed = ["large", "medium", "small"];
  const labels = {large: "大", medium: "中", small: "小"};
  const buttons = document.querySelectorAll("[data-font-size]");
  const toastEl = document.getElementById("toast");

  function normalize(value) {
    return allowed.includes(value) ? value : "large";
  }

  function readSaved() {
    try {
      return normalize(localStorage.getItem(key) || "large");
    } catch (error) {
      return "large";
    }
  }

  function save(size) {
    try {
      localStorage.setItem(key, size);
    } catch (error) {
      // Some private browsing modes block localStorage.
    }
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(window.__fontToastTimer);
    window.__fontToastTimer = setTimeout(() => toastEl.classList.remove("show"), 1400);
  }

  function apply(size, options = {}) {
    const next = normalize(size);
    document.body.classList.remove("font-large", "font-medium", "font-small");
    document.body.classList.add(`font-${next}`);
    buttons.forEach(button => {
      const active = button.dataset.fontSize === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (options.save) save(next);
    if (options.notify) toast(`字号：${labels[next]}`);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-font-size]");
    if (!button) return;
    apply(button.dataset.fontSize, {save: true, notify: true});
  });

  apply(readSaved());
})();
