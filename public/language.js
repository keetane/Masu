(() => {
  const key = "masu:v1:language";
  let language = "ja";
  try {
    if (localStorage.getItem(key) === "en") language = "en";
  } catch {
    /* Storage is optional. */
  }
  document.documentElement.lang = language;
  function apply(next) {
    language = next;
    document.documentElement.lang = language;
    const section = document.querySelector(
      '[data-language="' + language + '"]',
    );
    if (section) document.title = section.dataset.title + " | Masu";
    const group = document.querySelector(".language-switch");
    if (group)
      group.setAttribute("aria-label", language === "ja" ? "言語" : "Language");
    document
      .querySelectorAll("[data-set-language]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.setLanguage === language),
        ),
      );
  }
  document.addEventListener("DOMContentLoaded", () => {
    apply(language);
    document.querySelectorAll("[data-set-language]").forEach((button) =>
      button.addEventListener("click", () => {
        const next = button.dataset.setLanguage;
        if (next !== "ja" && next !== "en") return;
        apply(next);
        try {
          localStorage.setItem(key, next);
        } catch {
          /* Keep this page usable. */
        }
      }),
    );
  });
  window.addEventListener("storage", (event) => {
    if (
      event.key === key &&
      (event.newValue === "ja" || event.newValue === "en")
    )
      apply(event.newValue);
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    try {
      apply(localStorage.getItem(key) === "en" ? "en" : "ja");
    } catch {
      apply(language);
    }
  });
})();
