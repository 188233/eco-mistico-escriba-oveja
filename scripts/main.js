import { MODULE_ID } from "./format.js";
import { OvejaApplication } from "./app.js";

let app;
function open() {
  if (!game.user?.isGM) return ui.notifications.warn("Escriba Oveja es una herramienta para el Game Master.");
  if (!app?.rendered) app = new OvejaApplication();
  void app.render({ force: true });
  app.bringToFront();
  return app;
}

Hooks.once("ready", () => { game.modules.get(MODULE_ID).api = { open }; });
Hooks.on("renderJournalDirectory", (_application, element) => {
  if (!game.user?.isGM || !element?.querySelector || element.querySelector(".oveja-open")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "oveja-open";
  button.innerHTML = '<i class="fa-solid fa-feather-pointed"></i> Escriba Oveja';
  button.addEventListener("click", open);
  const target = element.querySelector(".header-actions") ?? element.querySelector(".directory-header") ?? element;
  target.prepend(button);
});
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  const tool = { name: "import-notes", title: "Escriba Oveja · Importar notas", icon: "fa-solid fa-feather-pointed", button: true, visible: true, onChange: open };
  controls[MODULE_ID] = {
    name: MODULE_ID, title: "Escriba Oveja", icon: "fa-solid fa-feather-pointed", visible: true, order: 97,
    onChange: (_event, active) => { if (active) open(); }, tools: { "import-notes": tool }
  };
});
