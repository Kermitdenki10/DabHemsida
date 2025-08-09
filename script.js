/*
  Enkel bokmärkessida
  - Lägg till, visa, sök och radera länkar
  - All data sparas i localStorage
*/

(() => {
  const STORAGE_KEY = "myLinks.v1";

  /** @typedef {{ id: string, title: string, url: string, category?: string }} LinkItem */

  const elements = {
    searchInput: /** @type {HTMLInputElement} */ (document.getElementById("searchInput")),
    toggleFormBtn: /** @type {HTMLButtonElement} */ (document.getElementById("toggleFormBtn")),
    formSection: /** @type {HTMLElement} */ (document.getElementById("formSection")),
    linkForm: /** @type {HTMLFormElement} */ (document.getElementById("linkForm")),
    titleInput: /** @type {HTMLInputElement} */ (document.getElementById("titleInput")),
    urlInput: /** @type {HTMLInputElement} */ (document.getElementById("urlInput")),
    categoryInput: /** @type {HTMLInputElement} */ (document.getElementById("categoryInput")),
    categoryOptions: /** @type {HTMLDataListElement} */ (document.getElementById("categoryOptions")),
    titleError: /** @type {HTMLElement} */ (document.getElementById("titleError")),
    urlError: /** @type {HTMLElement} */ (document.getElementById("urlError")),
    linkList: /** @type {HTMLElement} */ (document.getElementById("linkList")),
    count: /** @type {HTMLElement} */ (document.getElementById("count")),
    cancelBtn: /** @type {HTMLButtonElement} */ (document.getElementById("cancelBtn")),
    categoryFilter: /** @type {HTMLSelectElement} */ (document.getElementById("categoryFilter")),
  };

  /** @returns {LinkItem[]} */
  function loadLinks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x) => x && typeof x.title === "string" && typeof x.url === "string");
    } catch {
      return [];
    }
  }

  /** @param {LinkItem[]} links */
  function saveLinks(links) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  }

  /**
   * Säkerställ att URL:en har ett protokoll. Lägger till https:// om det saknas.
   * @param {string} value
   */
  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (trimmed === "") return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  /**
   * Rendera listan
   * @param {LinkItem[]} links
   * @param {string} search
   * @param {string} categoryFilter
   */
  function render(links, search = "", categoryFilter = "") {
    const query = search.trim().toLowerCase();
    let filtered = query
      ? links.filter((l) => l.title.toLowerCase().includes(query))
      : links;

    if (categoryFilter) {
      filtered = filtered.filter((l) => (l.category || "").toLowerCase() === categoryFilter.toLowerCase());
    }

    elements.count.textContent = String(filtered.length);

    if (filtered.length === 0) {
      elements.linkList.innerHTML = `<div class="link-item" style="grid-column: 1 / -1; justify-content: center;">
        Inga länkar än. Klicka på "Ny länk" för att lägga till.
      </div>`;
      return;
    }

    // Gruppera efter kategori
    const groups = groupByCategory(filtered);

    const html = Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, "sv"))
      .map((cat) => {
        const items = groups[cat]
          .map(
            (l) => `
        <article class="link-item" data-id="${l.id}">
          <div class="link-meta">
            <h3 class="link-title" title="${escapeHtml(l.title)}">${escapeHtml(l.title)}</h3>
          </div>
          <div class="link-actions">
            <a href="${encodeURI(l.url)}" target="_blank" rel="noopener" title="Öppna">
              <button type="button">Öppna</button>
            </a>
            <button type="button" class="danger" data-action="delete" title="Ta bort">Ta bort</button>
          </div>
        </article>`
          )
          .join("");
        return `
          <div class="category-group">
            <div class="category-header">${cat}</div>
            <div class="links">${items}</div>
          </div>`;
      })
      .join("");

    elements.linkList.innerHTML = html;
  }

  /** Enkel HTML-escape */
  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // App state
  let links = loadLinks();
  render(links);
  syncCategoryControls(links);

  // Sök
  elements.searchInput.addEventListener("input", () => {
    render(links, elements.searchInput.value, elements.categoryFilter.value);
  });

  // Visa/Göm formuläret
  elements.toggleFormBtn.addEventListener("click", () => {
    const willShow = elements.formSection.classList.contains("hidden");
    elements.formSection.classList.toggle("hidden");
    elements.toggleFormBtn.setAttribute("aria-expanded", String(willShow));
    if (willShow) {
      elements.titleInput.focus();
    }
  });

  // Avbryt
  elements.cancelBtn.addEventListener("click", () => {
    elements.linkForm.reset();
    clearErrors();
    elements.formSection.classList.add("hidden");
    elements.toggleFormBtn.setAttribute("aria-expanded", "false");
  });

  // Lägg till ny länk
  elements.linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors();

    const title = elements.titleInput.value.trim();
    let url = normalizeUrl(elements.urlInput.value);

    let hasError = false;
    if (title.length === 0) {
      elements.titleError.textContent = "Ange ett namn.";
      hasError = true;
    }
    if (url.length === 0) {
      elements.urlError.textContent = "Ange en URL.";
      hasError = true;
    } else if (!isLikelyUrl(url)) {
      elements.urlError.textContent = "Ogiltig URL.";
      hasError = true;
    }
    if (hasError) return;

    const category = (elements.categoryInput.value || "Okategoriserat").trim();
    const item = { id: cryptoRandomId(), title, url, category };
    links = [item, ...links];
    saveLinks(links);
    elements.linkForm.reset();
    elements.formSection.classList.add("hidden");
    elements.toggleFormBtn.setAttribute("aria-expanded", "false");
    syncCategoryControls(links);
    render(links, elements.searchInput.value, elements.categoryFilter.value);
  });

  // Ta bort via event-delegering
  elements.linkList.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const actionButton = target.closest("button[data-action=delete]");
    if (!actionButton) return;
    const card = target.closest(".link-item");
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (!id) return;

    links = links.filter((l) => l.id !== id);
    saveLinks(links);
    syncCategoryControls(links);
    render(links, elements.searchInput.value, elements.categoryFilter.value);
  });

  // Kategorifilter ändras
  elements.categoryFilter.addEventListener("change", () => {
    render(links, elements.searchInput.value, elements.categoryFilter.value);
  });

  function clearErrors() {
    elements.titleError.textContent = "";
    elements.urlError.textContent = "";
  }

  function isLikelyUrl(value) {
    try {
      // URL-klass kastar för ogiltiga värden
      // Säkerställ protokoll via normalizeUrl innan
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function cryptoRandomId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function groupByCategory(items) {
    /** @type {Record<string, LinkItem[]>} */
    const map = {};
    for (const it of items) {
      const key = (it.category && it.category.trim()) || "Okategoriserat";
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }

  function syncCategoryControls(items) {
    const unique = Array.from(
      new Set(
        items.map((l) => (l.category || "Okategoriserat").trim()).filter((s) => s.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "sv"));

    // Uppdatera datalist för formuläret
    elements.categoryOptions.innerHTML = unique.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");

    // Uppdatera filter-dropdown
    const current = elements.categoryFilter.value;
    elements.categoryFilter.innerHTML = `<option value="">Alla kategorier</option>` +
      unique.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    // Behåll vald kategori om den finns kvar
    if (unique.includes(current)) {
      elements.categoryFilter.value = current;
    }
  }
})();

