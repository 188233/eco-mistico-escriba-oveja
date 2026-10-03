import { escapeHtml, literal, toHtml } from "./text.js";

const THEMES = {
  expediente: "background-color:#f5efdf;color:#292a28;border:1px solid #b7aa88;",
  pergamino: "background-color:#eee0bc;color:#382719;border:1px solid #b49b63;",
  simple: "background-color:#fff;color:#242424;border:1px solid #bbb;"
};

function imagePath(id, paths) {
  const path = paths.get(id);
  if (!path) throw new Error(`La imagen ${id} todavía no tiene un archivo disponible.`);
  return path;
}

export function renderBookPage(page, style, paths) {
  const figure = block => `<figure style="margin:16px 0;break-inside:avoid;"><img src="${escapeHtml(imagePath(block.archivo, paths))}" alt="${literal(block.descripcion)}" style="display:block;max-width:100%;height:auto;margin:0 auto;border:0;">${block.pie ? `<figcaption style="text-align:center;font-size:0.9em;margin-top:6px;">${literal(block.pie)}</figcaption>` : ""}</figure>`;
  const content = page.tipo === "lamina" ? figure(page) + `<h3>Transcripción</h3>${toHtml(page.transcripcion)}`
    : page.bloques.map(block => {
      if (block.tipo === "imagen") return figure(block);
      if (block.tipo === "titulo") return `<h3 style="font-family:Georgia,serif;color:inherit;margin:20px 0 8px;">${literal(block.texto)}</h3>`;
      if (block.tipo === "lista") return `<ul>${block.elementos.map(item => `<li>${literal(item)}</li>`).join("")}</ul>`;
      if (block.tipo === "cita") return `<blockquote style="border-left:3px solid #9a8461;padding:4px 16px;margin:16px 0;color:inherit;">${toHtml(block.texto)}</blockquote>`;
      return toHtml(block.texto);
    }).join("\n");
  return `<div class="oveja-book-page" style="${THEMES[style] ?? THEMES.simple}padding:24px;font-family:Georgia,serif;line-height:1.6;overflow-wrap:anywhere;box-sizing:border-box;width:100%;"><h2 style="color:inherit;font-family:Georgia,serif;border-bottom:1px solid #9a8461;padding-bottom:12px;">${literal(page.titulo)}</h2>${content}</div>`;
}

export function makeBookPages(note, paths) {
  const pages = [];
  const push = (data, audience) => pages.push({ ...data, sort: (pages.length + 1) * 100000,
    ownership: { default: audience === "jugadores" ? 2 : 0 } });
  for (const page of note.paginas) {
    if (page.tipo === "lamina") {
      push({ name: page.titulo, type: "image", src: imagePath(page.archivo, paths), image: { caption: page.descripcion } }, page.config.visibilidad);
      push({ name: `${page.titulo} · Transcripción`, type: "text", title: { show: true, level: 1 },
        text: { format: 1, content: renderBookPage({ ...page, tipo: "texto", bloques: [{ tipo: "parrafo", texto: page.transcripcion }] }, note.config.estilo, paths) } }, page.config.visibilidad);
    } else {
      push({ name: page.titulo, type: "text", title: { show: true, level: 1 },
        text: { format: 1, content: renderBookPage(page, note.config.estilo, paths) } }, page.config.visibilidad);
    }
  }
  return pages;
}
