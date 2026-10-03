import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist/qa");
await mkdir(output, { recursive: true });
const uploads = new Map();
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Escriba Oveja · Ensayo aislado</title>
<link rel="stylesheet" href="/styles/oveja.css"><style>body{margin:0;background:#13171d;font:14px Arial,sans-serif;padding:24px}button{padding:8px}h3{margin-bottom:8px}.window-content{height:850px}.escriba-oveja{max-width:820px;margin:auto}#journal{max-width:820px;margin:25px auto}</style>
</head><body><main class="escriba-oveja"><div class="window-content" id="app"></div></main><div id="journal"></div>
<script src="/node_modules/handlebars/dist/handlebars.min.js"></script><script type="module">
const template=await (await fetch('/templates/import.hbs')).text();
class App {
 constructor(){this.element=document.querySelector('#app');this.element.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b&&!b.disabled)this.constructor.DEFAULT_OPTIONS.actions[b.dataset.action]?.call(this,e,b);});}
 async _prepareContext(){return {};}
 _onRender(){}
 async render(){this.element.innerHTML=Handlebars.compile(template)(await this._prepareContext({}));this._onRender({},{});return this;}
 async close(){this.element.innerHTML='';return this;}
}
window.notices=[];window.failUploadAt=0;window.uploadCount=0;
window.ui={notifications:{info:m=>notices.push(m),warn:m=>notices.push(m),error:m=>notices.push(m)}};
window.game={user:{isGM:true},journal:[],folders:[]};const dirs=new Set();
const Picker={
 async browse(s,p){if(!dirs.has(p))throw Error('missing');return {files:[]};},
 async createDirectory(s,p){if(dirs.has(p))throw Error('exists');dirs.add(p);return {path:p};},
 async upload(s,p,f){if(++uploadCount===failUploadAt)throw Error('Carga interrumpida de prueba');const response=await fetch('/test-upload?path='+encodeURIComponent(p+'/'+f.name),{method:'POST',body:f,headers:{'Content-Type':f.type}});return response.json();}
};
window.foundry={applications:{api:{ApplicationV2:App,HandlebarsApplicationMixin:B=>B},apps:{FilePicker:{implementation:Picker}}}};
window.CONFIG={Folder:{documentClass:{async create(data){const doc={...data,id:'f'+game.folders.length};game.folders.push(doc);return doc;}}},JournalEntry:{documentClass:{async create(data){const doc={...data,id:'j'+game.journal.length};game.journal.push(doc);return doc;}}}};
const {OvejaApplication}=await import('/scripts/app.js');window.app=new OvejaApplication();await app.render();
</script></body></html>`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") { res.setHeader("Content-Type", "text/html;charset=utf-8"); res.end(html); return; }
    if (url.pathname === "/test-upload" && req.method === "POST") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const key = url.searchParams.get("path");
      uploads.set(`/${key}`, { data: Buffer.concat(chunks), type: req.headers["content-type"] });
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ path: key })); return;
    }
    if (uploads.has(url.pathname)) { const file = uploads.get(url.pathname); res.setHeader("Content-Type", file.type); res.end(file.data); return; }
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
    const types = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".hbs": "text/plain" };
    res.setHeader("Content-Type", `${types[extname(path)] ?? "application/octet-stream"};charset=utf-8`);
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
const assertions = [];
try {
  browser = await chromium.launch({ headless: true, channel: process.env.OVEJA_BROWSER_CHANNEL ?? "msedge" });
  const page = await browser.newPage({ viewport: { width: 1150, height: 1050 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector("input[type=file]");
  await page.locator("input[type=file]").setInputFiles(resolve(root, "examples/expediente-demo.oveja.json"));
  await page.waitForFunction(() => app.pkg?.version === 2 && !app.busy);
  assert.equal(await page.locator(".oveja-page-preview").count(), 3);
  await page.locator(".oveja-page-preview > summary").first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".oveja-preview img")].every(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator(".oveja-preview [onerror]").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(output, "import-preview.png"), fullPage: true });
  assertions.push("Archivo único, decodificación real, 3 vistas previas e imágenes visibles sin desborde.");
  await page.locator('button[data-action="import"]').click();
  await page.waitForFunction(() => app.report?.created.length === 1 && !app.busy);
  assert.deepEqual(await page.evaluate(() => game.journal[0].pages.map(p => p.type)), ["text", "text", "image", "text"]);
  assert.deepEqual(await page.evaluate(() => game.journal[0].pages.map(p => p.ownership.default)), [0, 0, 0, 0]);
  assert.equal(uploads.size, 2);
  await page.evaluate(() => { const journal = game.journal[0]; document.querySelector("#journal").innerHTML = journal.pages.map(p => p.type === "text" ? p.text.content : '<img style="max-width:100%" src="'+p.src+'">').join("<hr>"); app.releasePreviews(); });
  await page.waitForFunction(() => [...document.querySelectorAll("#journal img")].every(img => img.complete && img.naturalWidth > 0));
  await page.locator("#journal").screenshot({ path: resolve(output, "journal-pages.png") });
  assertions.push("Un diario, 4 páginas ordenadas y 2 imágenes persistentes tras liberar la vista previa.");
  await page.locator("input[type=file]").setInputFiles(resolve(root, "examples/expediente-demo.oveja.json"));
  await page.waitForFunction(() => app.pkg && !app.busy);
  assert.ok(await page.locator('button[data-action="import"]').isDisabled());
  assert.equal(await page.evaluate(() => uploadCount), 2);
  assertions.push("Reimportación deshabilitada para un diario existente, sin repetir cargas.");
  await page.locator("input[type=file]").setInputFiles({ name: "roto.oveja.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await page.waitForFunction(() => app.error && !app.busy);
  assert.equal(await page.evaluate(() => app.pkg), null);
  assert.ok(await page.locator('button[data-action="import"]').isDisabled());
  assertions.push("Un archivo inválido descarta el paquete previo y bloquea importar.");
  const retry = JSON.parse(await readFile(resolve(root, "examples/expediente-demo.oveja.json"), "utf8")); retry.paquete = "demo-reintento";
  await page.locator("input[type=file]").setInputFiles({ name: "reintento.oveja.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(retry)) });
  await page.waitForFunction(() => app.pkg?.paquete === "demo-reintento" && !app.busy);
  await page.evaluate(() => { failUploadAt = uploadCount + 2; });
  await page.locator('button[data-action="import"]').click();
  await page.waitForFunction(() => app.report?.errors.length === 1 && !app.busy);
  assert.equal(await page.evaluate(() => game.journal.length), 1);
  await page.evaluate(() => { failUploadAt = 0; });
  await page.locator('button[data-action="import"]').click();
  await page.waitForFunction(() => app.report?.created.length === 1 && !app.busy);
  assert.equal(await page.evaluate(() => game.journal.length), 2);
  assertions.push("Carga fallida no crea un diario incompleto; reintento exitoso sin tocar el diario previo.");
  await page.setViewportSize({ width: 600, height: 950 });
  await page.screenshot({ path: resolve(output, "import-narrow.png"), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  assertions.push("Interfaz a 600 px sin desborde y sin errores JavaScript.");
  await writeFile(resolve(output, "browser-report.json"), JSON.stringify({ environment: "Edge headless con adaptadores Foundry simulados; NO Foundry real", assertions }, null, 2));
  console.log(assertions.map(value => `PASS: ${value}`).join("\n"));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
