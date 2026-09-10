import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODULE_ID, normalizePackage, parsePackage, makeJournalData, toHtml } from "../scripts/format.js";
import { importPackage, reviewPackage } from "../scripts/importer.js";

const example = JSON.parse(readFileSync(new URL("../examples/tres-notas.oveja.json", import.meta.url), "utf8"));
const copy = () => structuredClone(example);
function environment({ failAt = 0 } = {}) {
  const game = { user: { isGM: true }, journal: [], folders: [] };
  let calls = 0;
  return {
    game,
    Folder: { async create(data) { const doc = { ...data, id: `f${game.folders.length}` }; game.folders.push(doc); return doc; } },
    JournalEntry: { async create(data) {
      calls++;
      if (calls === failAt) throw new Error("Fallo de conexión simulado");
      const doc = { ...data, id: `j${game.journal.length}` }; game.journal.push(doc); return doc;
    } }
  };
}

test("el ejemplo y los datos normalizados se pueden validar sin perder contenido", () => {
  const pkg = parsePackage("\uFEFF" + JSON.stringify(example));
  assert.equal(pkg.notas.length, 3);
  const raw = copy();
  delete raw.notas[0].variaciones[0].condicion;
  const normalized = normalizePackage(raw);
  assert.deepEqual(normalizePackage(normalized), normalized);
  assert.equal(pkg.notas[0].config.visibilidad, "gm");
});

test("rechaza JSON roto, versión, tamaño, ids repetidos, campos desconocidos y config inválida", () => {
  assert.throws(() => parsePackage("{"), /JSON válido/);
  assert.throws(() => parsePackage(" ".repeat(2097153)), /2 MB/);
  for (const mutate of [
    p => { p.version = 2; },
    p => { p.notas.push(structuredClone(p.notas[0])); },
    p => { p.notas[0].config.visibilidad = "todos"; },
    p => { p.notas[0].config.ownership = { default: 3 }; },
    p => { p.notas[0].texto = ""; },
    p => { p.notas[0].variaciones.push(structuredClone(p.notas[0].variaciones[0])); },
    p => { p.notas[0].tipo = "dm"; p.notas[0].variaciones[0].config.visibilidad = "jugadores"; }
  ]) { const pkg = copy(); mutate(pkg); assert.throws(() => normalizePackage(pkg)); }
});

test("una página compartida no comparte variaciones ni la guía de descubrimiento", () => {
  const raw = copy();
  raw.notas[0].config.visibilidad = "jugadores";
  raw.notas[0].variaciones[0].condicion = "Secreto para el DM";
  const pkg = normalizePackage(raw);
  const journal = makeJournalData(pkg, pkg.notas[0], "folder");
  assert.equal(journal.ownership.default, 2);
  assert.deepEqual(journal.pages.map(page => page.ownership.default), [2, 0, 0]);
  assert.ok(!journal.pages[0].text.content.includes("Secreto para el DM"));
  assert.ok(journal.pages[2].text.content.includes("Secreto para el DM"));
  assert.equal(journal.flags[MODULE_ID].nota, raw.notas[0].id);
});

test("compartir solo una variación conserva el texto principal privado", () => {
  const raw = copy(); raw.notas[0].variaciones[0].config.visibilidad = "jugadores";
  const pkg = normalizePackage(raw);
  const journal = makeJournalData(pkg, pkg.notas[0], null);
  assert.equal(journal.ownership.default, 2);
  assert.deepEqual(journal.pages.slice(0, 2).map(page => page.ownership.default), [0, 2]);
});

test("texto externo no se convierte en HTML ni comandos de Foundry", () => {
  const html = toHtml('<script>alert(1)</script>\n@UUID[Macro.abc] [[/r 1d20]]\n\nSegundo párrafo');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("@UUID["));
  assert.ok(!html.includes("[["));
  assert.ok(html.includes("<br>"));
  assert.equal((html.match(/<p>/g) ?? []).length, 2);
});

test("crea tres diarios por categoría y omite una segunda importación", async () => {
  const env = environment();
  const selection = example.notas.map(note => note.id);
  const first = await importPackage(copy(), selection, env);
  assert.equal(first.created.length, 3);
  assert.equal(first.errors.length, 0);
  assert.equal(env.game.folders.length, 4);
  assert.ok(env.game.journal.every(journal => journal.ownership.default === 0 && journal.pages.every(page => page.ownership.default === 0)));
  assert.ok(reviewPackage(normalizePackage(copy()), env.game).every(note => note.duplicate));
  const second = await importPackage(copy(), selection, env);
  assert.equal(second.skipped.length, 3);
  assert.equal(env.game.journal.length, 3);
  assert.equal(env.game.folders.length, 4);
});

test("respeta la selección y reutiliza carpetas existentes bajo el padre correcto", async () => {
  const env = environment();
  env.game.folders.push({ id: "root", name: example.config.carpeta, type: "JournalEntry", folder: null });
  env.game.folders.push({ id: "rumors", name: "Rumores", type: "JournalEntry", folder: { id: "root" } });
  const report = await importPackage(copy(), [example.notas[0].id], env);
  assert.equal(report.created.length, 1);
  assert.equal(env.game.journal[0].folder, "rumors");
  assert.equal(env.game.folders.length, 2);
});

test("un fallo parcial informa lo creado y permite reintentar sin duplicar", async () => {
  const env = environment({ failAt: 2 });
  const selection = example.notas.map(note => note.id);
  const first = await importPackage(copy(), selection, env);
  assert.equal(first.created.length, 1);
  assert.equal(first.errors.length, 1);
  const retry = await importPackage(copy(), selection, env);
  assert.equal(retry.created.length, 2);
  assert.equal(retry.skipped.length, 1);
  assert.equal(env.game.journal.length, 3);
});

test("valida todo antes de escribir y rechaza importaciones de jugadores", async () => {
  const env = environment();
  const raw = copy(); raw.notas[2].texto = "";
  await assert.rejects(importPackage(raw, [raw.notas[0].id], env));
  assert.equal(env.game.folders.length, 0);
  env.game.user.isGM = false;
  await assert.rejects(importPackage(copy(), [raw.notas[0].id], env), /Game Master/);
  assert.equal(env.game.journal.length, 0);
});

test("nombres de carpetas ambiguos detienen la importación sin crear diarios", async () => {
  const env = environment();
  for (const id of ["a", "b"]) env.game.folders.push({ id, name: example.config.carpeta, type: "JournalEntry", folder: null });
  const report = await importPackage(copy(), [example.notas[0].id], env);
  assert.match(report.errors[0], /varias carpetas/);
  assert.equal(report.created.length, 0);
});
