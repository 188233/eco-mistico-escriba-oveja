import { object, string, id, visibility, array } from "./validation.js";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_BYTES = 20 * 1024 * 1024;
export const IMAGE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function imageBytes(asset) {
  const binary = atob(asset.base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function normalizeImage(raw, index) {
  const path = `imagenes[${index}]`;
  object(raw, path, ["id", "mime", "base64"]);
  const assetId = id(raw.id, `${path}.id`);
  if (!Object.hasOwn(IMAGE_EXTENSIONS, raw.mime)) throw new Error(`${path}.mime: usá image/png, image/jpeg o image/webp.`);
  if (typeof raw.base64 !== "string" || raw.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !raw.base64.length
      || raw.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw.base64)) throw new Error(`${path}: imagen base64 inválida o mayor de 8 MB.`);
  const bytes = imageBytes(raw);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`${path}: imagen demasiado grande.`);
  const starts = values => values.every((value, offset) => bytes[offset] === value);
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  const valid = raw.mime === "image/png" ? starts([137,80,78,71,13,10,26,10])
    : raw.mime === "image/jpeg" ? starts([255,216,255])
      : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!valid) throw new Error(`${path}: el contenido no coincide con ${raw.mime}.`);
  return { id: assetId, mime: raw.mime, base64: raw.base64 };
}

function block(raw, path, imageIds) {
  object(raw, path, ["tipo", "texto", "elementos", "archivo", "descripcion", "pie"]);
  const fields = {
    titulo: ["tipo", "texto"], parrafo: ["tipo", "texto"], cita: ["tipo", "texto"],
    lista: ["tipo", "elementos"], imagen: ["tipo", "archivo", "descripcion", "pie"]
  };
  if (!Object.hasOwn(fields, raw.tipo)) throw new Error(`${path}.tipo: usá titulo, parrafo, cita, lista o imagen.`);
  object(raw, path, fields[raw.tipo]);
  if (raw.tipo === "imagen") {
    const ref = id(raw.archivo, `${path}.archivo`);
    if (!imageIds.has(ref)) throw new Error(`${path}.archivo: falta la imagen ${ref}.`);
    return { tipo: "imagen", archivo: ref, descripcion: string(raw.descripcion, `${path}.descripcion`, 1000),
      pie: raw.pie === undefined || raw.pie === "" ? "" : string(raw.pie, `${path}.pie`, 2000) };
  }
  if (raw.tipo === "lista") return { tipo: raw.tipo, elementos: array(raw.elementos, `${path}.elementos`, 1, 50).map((text, i) => string(text, `${path}.elementos[${i}]`, 10000)) };
  return { tipo: raw.tipo, texto: string(raw.texto, `${path}.texto`, raw.tipo === "titulo" ? 160 : 100000) };
}

export function normalizeV2(input) {
  object(input, "Paquete v2", ["formato", "version", "paquete", "titulo", "config", "imagenes", "notas"]);
  const config = object(input.config === undefined ? {} : input.config, "config", ["carpeta"]);
  const images = array(input.imagenes === undefined ? [] : input.imagenes, "imagenes", 0, 30).map(normalizeImage);
  const imageIds = new Set(images.map(image => image.id));
  if (imageIds.size !== images.length) throw new Error("imagenes: identificadores repetidos.");
  const bytes = images.reduce((total, image) => total + image.base64.length * 3 / 4 - (image.base64.endsWith("==") ? 2 : image.base64.endsWith("=") ? 1 : 0), 0);
  if (bytes > MAX_IMAGES_BYTES) throw new Error("Las imágenes juntas superan 20 MB.");
  const noteIds = new Set();
  const notes = array(input.notas, "notas", 1, 100).map((raw, index) => {
    const path = `notas[${index}]`;
    object(raw, path, ["id", "titulo", "tipo", "categoria", "config", "paginas"]);
    const noteId = id(raw.id, `${path}.id`);
    if (noteIds.has(noteId)) throw new Error(`${path}: id repetido ${noteId}.`);
    noteIds.add(noteId);
    const type = raw.tipo === undefined ? "lore" : raw.tipo;
    if (!["lore", "dm"].includes(type)) throw new Error(`${path}.tipo: debe ser lore o dm.`);
    const noteConfig = object(raw.config === undefined ? {} : raw.config, `${path}.config`, ["estilo"]);
    const style = noteConfig.estilo === undefined ? "expediente" : noteConfig.estilo;
    if (!["simple", "expediente", "pergamino"].includes(style)) throw new Error(`${path}.config.estilo: usá simple, expediente o pergamino.`);
    const pageIds = new Set();
    const pages = array(raw.paginas, `${path}.paginas`, 1, 50).map((page, pi) => {
      const pp = `${path}.paginas[${pi}]`;
      object(page, pp, ["id", "titulo", "tipo", "config", "bloques", "archivo", "descripcion", "transcripcion"]);
      const pageId = id(page.id, `${pp}.id`);
      if (pageIds.has(pageId)) throw new Error(`${pp}: id repetido ${pageId}.`);
      pageIds.add(pageId);
      const base = { id: pageId, titulo: string(page.titulo, `${pp}.titulo`), tipo: page.tipo,
        config: visibility(page.config === undefined ? {} : page.config, `${pp}.config`, type === "dm") };
      if (page.tipo === "texto") {
        object(page, pp, ["id", "titulo", "tipo", "config", "bloques"]);
        return { ...base, bloques: array(page.bloques, `${pp}.bloques`, 1, 100).map((b, bi) => block(b, `${pp}.bloques[${bi}]`, imageIds)) };
      }
      if (page.tipo === "lamina") {
        object(page, pp, ["id", "titulo", "tipo", "config", "archivo", "descripcion", "transcripcion"]);
        const ref = id(page.archivo, `${pp}.archivo`);
        if (!imageIds.has(ref)) throw new Error(`${pp}.archivo: falta la imagen ${ref}.`);
        return { ...base, archivo: ref, descripcion: string(page.descripcion, `${pp}.descripcion`, 1000),
          transcripcion: string(page.transcripcion, `${pp}.transcripcion`, 100000) };
      }
      throw new Error(`${pp}.tipo: debe ser texto o lamina.`);
    });
    return { id: noteId, titulo: string(raw.titulo, `${path}.titulo`), tipo: type,
      categoria: string(raw.categoria === undefined ? (type === "dm" ? "Notas del DM" : "Lore") : raw.categoria, `${path}.categoria`, 80),
      config: { estilo: style }, paginas: pages };
  });
  return { formato: "escriba-oveja", version: 2, paquete: id(input.paquete, "paquete"), titulo: string(input.titulo, "titulo"),
    config: { carpeta: string(config.carpeta === undefined ? "Escriba Oveja" : config.carpeta, "config.carpeta", 80) }, imagenes: images, notas: notes };
}

export function noteImageIds(note) {
  return new Set((note.paginas ?? []).flatMap(page => page.tipo === "lamina" ? [page.archivo]
    : page.bloques.filter(block => block.tipo === "imagen").map(block => block.archivo)));
}
