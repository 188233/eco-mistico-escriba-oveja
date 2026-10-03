import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import Handlebars from "handlebars";
import { parsePackage, normalizePackage, makeJournalData, MAX_FILE_BYTES } from "../scripts/format.js";
import { imageBytes } from "../scripts/format-v2.js";
import { importPackage, reviewPackage } from "../scripts/importer.js";
import { validateImages } from "../scripts/media.js";

const source = readFileSync(new URL("../examples/expediente-demo.oveja.json", import.meta.url), "utf8");
const fixture = () => parsePackage(source);
const selection = ["expediente-demo"];
const decoder = async blob => {
  const { width, height } = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  return { width, height, close() {} };
};
function environment({ uploadFailure = 0, journalFailure = 0 } = {}) {
  let uploaded = 0, created = 0;
  const dirs = new Set();
  const log = [];
  const game = { user: { isGM: true }, journal: [], folders: [] };
  return { game, log, dirs, decodeImage: decoder,
    Folder: { async create(data) { const doc = { ...data, id: `f${game.folders.length}` }; game.folders.push(doc); return doc; } },
    JournalEntry: { async create(data) {
      if (++created === journalFailure) throw new Error("Error de diario simulado");
      const doc = { ...data, id: `j${game.journal.length}` }; game.journal.push(doc); return doc;
    } },
    FilePicker: {
      async browse(_source, path) { if (!dirs.has(path)) throw new Error("No existe"); return { files: [] }; },
      async createDirectory(_source, path) { if (dirs.has(path)) throw new Error("Ya existe"); dirs.add(path); return { path }; },
      async upload(_source, path, file) {
        if (++uploaded === uploadFailure) throw new Error("Error de carga simulado");
        log.push({ path, name: file.name, mime: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
        return { path: `${path}/${file.name}` };
      }
    }
  };
}

test("v2 conserva la estructura del expediente y se puede normalizar otra vez", () => {
  const pkg = fixture();
  assert.deepEqual(normalizePackage(pkg), pkg);
  assert.equal(pkg.notas[0].paginas.length, 3);
  assert.equal(pkg.imagenes.length, 2);
});

test("rechaza imágenes ausentes, SVG, base64 falso, duplicados y campos ejecutables", () => {
  for (const mutate of [
    p => { p.imagenes.pop(); },
    p => { p.imagenes[0].mime = "image/svg+xml"; },
    p => { p.imagenes[0].base64 = Buffer.from("<script>bad</script>").toString("base64"); },
    p => { p.imagenes[0].base64 = "data:image/png;base64,AAAA"; },
    p => { p.imagenes.push(p.imagenes[0]); },
    p => { p.notas[0].paginas[0].html = "<script>bad</script>"; },
    p => { p.notas[0].paginas[0].bloques[0].style = "position:fixed"; },
    p => { p.notas[0].paginas[0].config = null; },
    p => { p.notas[0].paginas[2].transcripcion = ""; },
    p => { p.notas[0].paginas.push(p.notas[0].paginas[0]); },
    p => { p.notas[0].config.estilo = "inexistente"; }
  ]) { const pkg = fixture(); mutate(pkg); assert.throws(() => normalizePackage(pkg)); }
});

test("límites de archivo e imagen y versiones desconocidas", () => {
  assert.throws(() => parsePackage(" ".repeat(MAX_FILE_BYTES + 1)), /32 MB/);
  const pkg = fixture(); pkg.imagenes[0].base64 = "A".repeat(12 * 1024 * 1024);
  assert.throws(() => normalizePackage(pkg), /8 MB/);
  assert.throws(() => normalizePackage({ ...fixture(), version: 3 }));
});

test("los tres formatos de imagen se validan y conservan sus bytes", async () => {
  for (const [mime, format] of [["image/png", "png"], ["image/jpeg", "jpeg"], ["image/webp", "webp"]]) {
    const bytes = await sharp({ create: { width: 80, height: 50, channels: 3, background: "#abcdef" } }).toFormat(format).toBuffer();
    const pkg = fixture(); pkg.imagenes[0] = { id: pkg.imagenes[0].id, mime, base64: bytes.toString("base64") };
    const normalized = normalizePackage(pkg);
    await validateImages(normalized.imagenes, decoder);
    assert.deepEqual(Buffer.from(imageBytes(normalized.imagenes[0])), bytes);
  }
});

test("una imagen corrupta o demasiado grande en píxeles bloquea antes de escribir", async () => {
  const pkg = fixture(); pkg.imagenes[0].base64 = Buffer.from([137,80,78,71,13,10,26,10]).toString("base64");
  const env = environment();
  await assert.rejects(importPackage(pkg, selection, env), /no puede usarse/);
  assert.equal(env.game.folders.length, 0); assert.equal(env.dirs.size, 0);
  let closed = false;
  await assert.rejects(validateImages(fixture().imagenes, async () => ({ width: 9000, height: 1, close() { closed = true; } })), /8192/);
  assert.ok(closed);
});

test("importa un libro con imagen real, lámina y transcripción en el orden correcto", async () => {
  const env = environment(); const pkg = fixture();
  const report = await importPackage(pkg, selection, env);
  assert.equal(report.errors.length, 0); assert.equal(report.created.length, 1);
  assert.equal(report.uploaded.length, 2);
  const pages = env.game.journal[0].pages;
  assert.deepEqual(pages.map(page => page.type), ["text", "text", "image", "text"]);
  assert.ok(pages[0].text.content.includes(report.uploaded[0]));
  assert.equal(pages[2].src, report.uploaded[1]);
  assert.ok(pages[3].text.content.includes("SIN VALOR DE EVIDENCIA"));
  assert.ok(pages.every(page => page.ownership.default === 0));
  assert.deepEqual(pages.map(page => page.sort), [100000, 200000, 300000, 400000]);
  assert.deepEqual(env.log[0].bytes, Buffer.from(pkg.imagenes[0].base64, "base64"));
  assert.ok(!JSON.stringify(env.game.journal).includes(pkg.imagenes[0].base64));
});

test("permisos mixtos mantienen explícitamente privadas las páginas del DM", () => {
  const pkg = fixture(); pkg.notas[0].paginas[2].config.visibilidad = "jugadores";
  const paths = new Map(pkg.imagenes.map(image => [image.id, `test/${image.id}.png`]));
  const journal = makeJournalData(normalizePackage(pkg), pkg.notas[0], null, paths);
  assert.equal(journal.ownership.default, 2);
  assert.deepEqual(journal.pages.map(page => page.ownership.default), [0, 0, 2, 2]);
  pkg.notas[0].tipo = "dm";
  assert.throws(() => normalizePackage(pkg), /privadas/);
});

test("la previsualización y el HTML importado escapan texto, atributos y comandos", () => {
  const pkg = fixture();
  pkg.notas[0].paginas[0].bloques[0].texto = '<script>alert(1)</script> @UUID[Macro.a] [[/r 1d20]]';
  pkg.notas[0].paginas[0].bloques[1].descripcion = '\" onerror=\"alert(1)';
  const paths = new Map(pkg.imagenes.map(image => [image.id, `blob:test-${image.id}`]));
  const rows = reviewPackage(normalizePackage(pkg), { journal: [] }, paths);
  assert.ok(!rows[0].pages[0].html.includes("<script>"));
  assert.ok(!rows[0].pages[0].html.includes("@UUID["));
  assert.ok(!rows[0].pages[0].html.includes("[["));
  const template = Handlebars.compile(readFileSync(new URL("../templates/import.hbs", import.meta.url), "utf8"));
  const html = template({ notes: rows, hasPackage: true, illustrated: true, imageCount: 2 });
  assert.ok(html.includes("oveja-book-page")); assert.ok(html.includes("Transcripción"));
  assert.ok(!html.includes("<script>"));
});

test("reimportar un libro existente no escribe ni sube imágenes nuevamente", async () => {
  const env = environment();
  await importPackage(fixture(), selection, env);
  const count = env.log.length;
  env.decodeImage = () => { throw new Error("No debe decodificar duplicados"); };
  const report = await importPackage(fixture(), selection, env);
  assert.equal(report.skipped.length, 1); assert.equal(env.log.length, count);
});

test("no sube imágenes de notas desmarcadas y reutiliza las compartidas", async () => {
  const pkg = fixture();
  pkg.notas.push({ ...structuredClone(pkg.notas[0]), id: "segundo", titulo: "Segundo expediente" });
  pkg.notas[0].paginas = [pkg.notas[0].paginas[0]];
  const selectedEnv = environment();
  await importPackage(pkg, selection, selectedEnv);
  assert.equal(selectedEnv.log.length, 1);
  const allEnv = environment();
  await importPackage(pkg, ["expediente-demo", "segundo"], allEnv);
  assert.equal(allEnv.log.length, 2); assert.equal(allEnv.game.journal.length, 2);
});

test("fallo de imagen no deja un diario con enlaces rotos e informa los archivos subidos", async () => {
  const env = environment({ uploadFailure: 2 });
  const first = await importPackage(fixture(), selection, env);
  assert.equal(first.errors.length, 1); assert.equal(first.uploaded.length, 1);
  assert.equal(env.game.journal.length, 0);
  const retry = await importPackage(fixture(), selection, env);
  assert.equal(retry.created.length, 1); assert.notEqual(first.mediaDirectory, retry.mediaDirectory);
});

test("respuesta de upload sin ruta y fallo de carpeta detienen la operación", async () => {
  for (const mutation of [
    env => { env.FilePicker.upload = async () => ({ error: "denegado" }); },
    env => { env.FilePicker.createDirectory = async () => { throw new Error("sin permiso"); }; }
  ]) {
    const env = environment(); mutation(env);
    const report = await importPackage(fixture(), selection, env);
    assert.equal(report.errors.length, 1); assert.equal(env.game.journal.length, 0);
  }
});

test("un diario ya creado sobrevive al fallo siguiente y el reintento solo crea lo pendiente", async () => {
  const pkg = fixture(); pkg.notas.push({ ...structuredClone(pkg.notas[0]), id: "segundo" });
  const env = environment({ journalFailure: 2 });
  const first = await importPackage(pkg, ["expediente-demo", "segundo"], env);
  assert.equal(first.created.length, 1); assert.equal(first.errors.length, 1);
  const retry = await importPackage(pkg, ["expediente-demo", "segundo"], env);
  assert.equal(retry.skipped.length, 1); assert.equal(retry.created.length, 1);
  assert.equal(env.game.journal.length, 2);
});
