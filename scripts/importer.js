import { MODULE_ID, makeJournalData, normalizePackage } from "./format.js";

let importing = false;
export function existingNote(game, pkg, note) {
  return [...game.journal].find(entry => {
    const flags = entry.flags?.[MODULE_ID];
    return flags?.paquete === pkg.paquete && flags?.nota === note.id;
  });
}

export function reviewPackage(pkg, game) {
  return pkg.notas.map(note => ({
    ...note,
    destination: `${pkg.config.carpeta} / ${note.categoria} / ${note.titulo}`,
    duplicate: Boolean(existingNote(game, pkg, note)),
    audience: note.config.visibilidad === "jugadores" ? "Jugadores" : "Solo DM",
    variations: note.variaciones.map(variation => ({
      ...variation, audience: variation.config.visibilidad === "jugadores" ? "Jugadores" : "Solo DM"
    }))
  }));
}

async function ensureFolder(name, parent, game, Folder) {
  const matches = [...game.folders].filter(folder => folder.type === "JournalEntry"
    && folder.name === name && (folder.folder?.id ?? folder.folder ?? null) === parent);
  if (matches.length > 1) throw new Error(`Hay varias carpetas llamadas «${name}» en el mismo destino. Renombrá una antes de continuar.`);
  if (matches[0]) return matches[0];
  const created = await Folder.create({ name, type: "JournalEntry", folder: parent, sorting: "a" });
  if (!created) throw new Error(`Foundry no permitió crear la carpeta «${name}».`);
  return created;
}

export async function importPackage(input, selection, env = globalThis) {
  if (!env.game.user?.isGM) throw new Error("Solo el Game Master puede importar notas.");
  if (importing) throw new Error("Ya hay una importación en curso en esta sesión.");
  const pkg = normalizePackage(input);
  const selected = new Set(selection);
  const notes = pkg.notas.filter(note => selected.has(note.id));
  if (!notes.length) throw new Error("Seleccioná al menos una nota.");
  if ([...selected].some(id => !pkg.notas.some(note => note.id === id))) throw new Error("La selección contiene una nota que no pertenece al paquete.");
  const report = { created: [], skipped: [], errors: [] };
  importing = true;
  try {
    let root;
    const categories = new Map();
    for (const note of notes) {
      if (existingNote(env.game, pkg, note)) {
        report.skipped.push(note.titulo);
        continue;
      }
      try {
        root ??= await ensureFolder(pkg.config.carpeta, null, env.game, env.Folder);
        if (!categories.has(note.categoria)) {
          categories.set(note.categoria, await ensureFolder(note.categoria, root.id, env.game, env.Folder));
        }
        const data = makeJournalData(pkg, note, categories.get(note.categoria).id);
        const entry = await env.JournalEntry.create(data, { renderSheet: false });
        if (!entry) throw new Error("Foundry canceló la creación del diario.");
        report.created.push({ id: entry.id, title: entry.name });
      } catch (error) {
        report.errors.push(`${note.titulo}: ${error.message ?? error}`);
        break;
      }
    }
  } finally { importing = false; }
  return report;
}
