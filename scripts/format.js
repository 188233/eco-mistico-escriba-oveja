export const MODULE_ID = "eco-mistico-escriba-oveja";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const identifier = /^[a-z0-9][a-z0-9_-]{0,79}$/;

function object(value, path, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: se esperaba un objeto.`);
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`${path}: campos desconocidos: ${extra.join(", ")}.`);
  return value;
}

function string(value, path, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${path}: debe ser texto no vacío de hasta ${max} caracteres.`);
  }
  return value.trim();
}

function id(value, path) {
  if (typeof value !== "string" || !identifier.test(value)) throw new Error(`${path}: usá minúsculas, números, guiones o guiones bajos (máximo 80 caracteres).`);
  return value;
}

function visibility(config, path, dm = false) {
  object(config, path, ["visibilidad"]);
  const value = config.visibilidad ?? "gm";
  if (!["gm", "jugadores"].includes(value)) throw new Error(`${path}.visibilidad: debe ser gm o jugadores.`);
  if (dm && value !== "gm") throw new Error(`${path}: una nota del DM y sus variaciones deben ser privadas (gm).`);
  return { visibilidad: value };
}

export function normalizePackage(input) {
  object(input, "Paquete", ["formato", "version", "paquete", "titulo", "config", "notas"]);
  if (input.formato !== "escriba-oveja" || input.version !== 1) throw new Error("Formato no compatible: se requiere formato escriba-oveja y version 1.");
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
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error("El archivo supera el máximo de 2 MB.");
  let input;
  try { input = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("El archivo no contiene JSON válido. Revisá comillas, comas y saltos de línea."); }
  return normalizePackage(input);
}

// El formato v1 admite texto plano: nunca acepta HTML, macros o datos de documentos.
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function toHtml(text) {
  // Evita que el enriquecedor de Foundry convierta texto importado en comandos/enlaces.
  const safe = escapeHtml(text).replace(/@/g, "@\u200b").replace(/\[\[/g, "[\u200b[");
  return safe.split(/\r?\n\s*\r?\n/).map(part => `<p>${part.replace(/\r?\n/g, "<br>")}</p>`).join("\n");
}

export function makeJournalData(pkg, note, folder) {
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
