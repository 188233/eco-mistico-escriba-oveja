import { MODULE_ID, MAX_FILE_BYTES, parsePackage } from "./format.js";
import { importPackage, reviewPackage } from "./importer.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class OvejaApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: ["escriba-oveja"],
    position: { width: 800, height: 720 },
    window: { title: "Eco Místico — Escriba Oveja", icon: "fa-solid fa-feather-pointed", resizable: true },
    actions: { import: this.onImport, example: this.onExample }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/import.hbs`, scrollable: [".oveja-review"] } };

  constructor(options = {}) {
    super(options);
    this.pkg = null;
    this.selection = new Set();
    this.filename = "";
    this.error = "";
    this.report = null;
    this.busy = false;
  }

  async _prepareContext(options) {
    const notes = this.pkg ? reviewPackage(this.pkg, game).map(note => ({ ...note, selected: this.selection.has(note.id) && !note.duplicate })) : [];
    const pending = notes.filter(note => note.selected).length;
    return {
      ...await super._prepareContext(options),
      notes, filename: this.filename, title: this.pkg?.titulo, error: this.error,
      report: this.report, hasPackage: Boolean(this.pkg), busy: this.busy,
      importDisabled: this.busy || !pending, pending,
      status: this.busy ? "Procesando…" : `${pending} nota(s) seleccionadas`
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("input[type=file]")?.addEventListener("change", event => {
      void this.loadFile(event.target.files?.[0]);
    });
    this.element.querySelectorAll("input[data-note]").forEach(input => {
      input.addEventListener("change", () => {
        if (this.busy) return;
        if (input.checked) this.selection.add(input.dataset.note);
        else this.selection.delete(input.dataset.note);
        void this.render();
      });
    });
  }

  async loadFile(file) {
    if (!file || this.busy) return;
    this.busy = true;
    this.pkg = null;
    this.selection.clear();
    this.report = null;
    this.error = "";
    this.filename = file.name;
    try {
      await this.render();
      if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera el máximo de 2 MB.");
      this.pkg = parsePackage(await file.text());
      this.selection = new Set(reviewPackage(this.pkg, game).filter(note => !note.duplicate).map(note => note.id));
    } catch (error) { this.error = error.message ?? String(error); }
    finally { this.busy = false; await this.render(); }
  }

  static async onImport() {
    if (this.busy || !this.pkg) return;
    this.busy = true;
    this.error = "";
    try {
      await this.render();
      this.report = await importPackage(this.pkg, [...this.selection], {
        game, Folder: CONFIG.Folder.documentClass, JournalEntry: CONFIG.JournalEntry.documentClass
      });
      const review = reviewPackage(this.pkg, game);
      for (const note of review) if (note.duplicate) this.selection.delete(note.id);
      if (this.report.errors.length) ui.notifications.warn("La importación se detuvo. Revisá el informe y reintentá las notas pendientes.");
      else ui.notifications.info(`Escriba Oveja: ${this.report.created.length} diario(s) creados; ${this.report.skipped.length} omitidos.`);
    } catch (error) { this.error = error.message ?? String(error); }
    finally { this.busy = false; await this.render(); }
  }

  static async onExample() {
    try {
      const response = await fetch(`modules/${MODULE_ID}/examples/tres-notas.oveja.json`);
      if (!response.ok) throw new Error("No se pudo leer el ejemplo instalado.");
      const blob = new Blob([await response.text()], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tres-notas.oveja.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { ui.notifications.error(error.message ?? String(error)); }
  }
}
