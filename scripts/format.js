import { object, string, id, visibility } from "./validation.js";
import { normalizeV2 } from "./format-v2.js";
import { makeBookPages } from "./book-renderer.js";
import { toHtml } from "./text.js";
export { toHtml, escapeHtml } from "./text.js";
export const MODULE_ID = "eco-mistico-escriba-oveja";
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function normalizePackage(input) {
  if (input?.formato === "escriba-oveja" && input.version === 2) return normalizeV2(input);
  object(input, "Paquete", ["formato", "version", "paquete", "titulo", "config", "notas"]);
  if (input.formato !== "escriba-oveja" || input.version !== 1) throw new Error("Formato no compatible: se requiere formato escriba-oveja y version 1 o 2. No cargues un JSON nativo de Foundry ni una macro.");
  const config = object(input.config ?? {}, "config", ["carpeta"]);
  if (!Array.isArray(input.notas) || !input.notas.length || input.notas.length > 100) throw new Error("notas: incluí entre 1 y 100 notas.");
  const seen = new Set();
  const notes = input.notas.map((raw, index) => {
    const path = `notas[${index}]`;
    object(raw, path, ["id", "titulo", "texto", "tipo", "categoria", "variaciones", "config"]);
    const noteId = id(raw.id, `${path}.id`);
    if (seen.has(noteId)) throw new Error(`${path}.id: identificador repetido ${noteId}.`);
    seen.add(noteId);
    const type = raw.tipo ?? "lore";
    if (!["lore", "dm"].includes(type)) throw new Error(`${path}.tipo: debe ser lore o dm.`);
    const variations = raw.variaciones ?? [];
    if (!Array.isArray(variations) || variations.length > 20) throw new Error(`${path}.variaciones: se admite una lista de hasta 20 variaciones.`);
    const variationIds = new Set();
    return {
      id: noteId,
      titulo: string(raw.titulo, `${path}.titulo`),
      texto: string(raw.texto, `${path}.texto`, 100000),
      tipo: type,
      categoria: string(raw.categoria ?? (type === "dm" ? "Notas del DM" : "Lore"), `${path}.categoria`, 80),
      config: visibility(raw.config ?? {}, `${path}.config`, type === "dm"),
      variaciones: variations.map((variation, variationIndex) => {
        const vp = `${path}.variaciones[${variationIndex}]`;
        object(variation, vp, ["id", "titulo", "texto", "condicion", "config"]);
        const variationId = id(variation.id, `${vp}.id`);
        if (variationIds.has(variationId)) throw new Error(`${vp}.id: identificador repetido ${variationId}.`);
        variationIds.add(variationId);
        return {
          id: variationId,
          titulo: string(variation.titulo, `${vp}.titulo`),
          texto: string(variation.texto, `${vp}.texto`, 100000),
          condicion: variation.condicion === undefined || variation.condicion === "" ? "" : string(variation.condicion, `${vp}.condicion`, 4000),
          config: visibility(variation.config ?? {}, `${vp}.config`, type === "dm")
        };
      })
    };
  });
  return {
    formato: "escriba-oveja", version: 1,
    paquete: id(input.paquete, "paquete"),
    titulo: string(input.titulo, "titulo"),
    config: { carpeta: string(config.carpeta ?? "Escriba Oveja", "config.carpeta", 80) },
    notas: notes
  };
}

export function parsePackage(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error("El archivo supera el máximo de 32 MB.");
  let input;
  try { input = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("El archivo no contiene JSON válido. Revisá comillas, comas y saltos de línea."); }
  if (input?.version === 1 && new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error("Los paquetes v1 admiten hasta 2 MB.");
  return normalizePackage(input);
}

export function makeJournalData(pkg, note, folder, imagePaths = new Map()) {
  if (pkg.version === 2) {
    const pages = makeBookPages(note, imagePaths);
    return { name: note.titulo, folder, pages,
      ownership: { default: pages.some(page => page.ownership.default === 2) ? 2 : 0 },
      flags: { [MODULE_ID]: { paquete: pkg.paquete, nota: note.id, tipo: note.tipo, categoria: note.categoria, version: 2 } } };
  }
  const page = (title, text, audience, sort) => ({
    name: title, type: "text", sort,
    title: { show: true, level: 1 },
    text: { format: 1, content: toHtml(text) },
    ownership: { default: audience === "jugadores" ? 2 : 0 }
  });
  const pages = [page(note.titulo, note.texto, note.config.visibilidad, 100000)];
  note.variaciones.forEach((variation, index) => {
    pages.push(page(variation.titulo, variation.texto, variation.config.visibilidad, (index + 2) * 100000));
  });
  const guide = note.variaciones.filter(variation => variation.condicion)
    .map(variation => `${variation.titulo}\nCuándo descubrirla: ${variation.condicion}`);
  if (guide.length) pages.push(page("Guía de descubrimiento · DM", guide.join("\n\n"), "gm", (pages.length + 1) * 100000));
  return {
    name: note.titulo, folder, pages,
    // OBSERVER permite encontrar el diario; cada página fija su propio permiso.
    ownership: { default: pages.some(entry => entry.ownership.default === 2) ? 2 : 0 },
    flags: { [MODULE_ID]: { paquete: pkg.paquete, nota: note.id, tipo: note.tipo, categoria: note.categoria, version: 1 } }
  };
}
