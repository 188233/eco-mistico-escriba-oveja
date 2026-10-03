import { IMAGE_EXTENSIONS, imageBytes, noteImageIds } from "./format-v2.js";

// Validación de decodificación real, además de las firmas verificadas al leer JSON.
export async function validateImages(assets, decode = globalThis.createImageBitmap) {
  if (!assets.length) return;
  if (typeof decode !== "function") throw new Error("Este navegador no permite validar las imágenes. Usá un navegador compatible con Foundry v14.");
  for (const asset of assets) {
    let bitmap;
    try {
      bitmap = await decode(new Blob([imageBytes(asset)], { type: asset.mime }));
      if (!bitmap.width || !bitmap.height || bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 32000000) {
        throw new Error("máximo 8192 píxeles por lado y 32 megapíxeles");
      }
    } catch (error) { throw new Error(`La imagen ${asset.id} no puede usarse: ${error.message ?? error}.`); }
    finally { bitmap?.close?.(); }
  }
}

export function selectedImages(pkg, notes) {
  const ids = new Set(notes.flatMap(note => [...noteImageIds(note)]));
  return (pkg.imagenes ?? []).filter(asset => ids.has(asset.id));
}

export class MediaSession {
  constructor(pkg, env) {
    this.pkg = pkg;
    this.env = env;
    this.paths = new Map();
    this.directory = "";
    this.uploaded = [];
  }

  async ensureDirectory() {
    if (this.directory) return;
    const Picker = this.env.FilePicker;
    if (!Picker?.browse || !Picker?.createDirectory || !Picker?.upload) throw new Error("La carga de archivos de Foundry no está disponible.");
    const root = "escriba-oveja";
    try { await Picker.browse("data", root); }
    catch {
      try { await Picker.createDirectory("data", root); }
      catch { await Picker.browse("data", root); }
    }
    // Nueva carpeta por intento: nunca se reemplazan imágenes ya utilizadas.
    const crypto = this.env.crypto ?? globalThis.crypto;
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const directory = `${root}/${nonce}`;
    const result = await Picker.createDirectory("data", directory);
    if (result === false || result?.error) throw new Error(`No se pudo crear la carpeta de imágenes: ${result?.error ?? directory}.`);
    this.directory = directory;
  }

  async forNote(note) {
    const assets = selectedImages(this.pkg, [note]).filter(asset => !this.paths.has(asset.id));
    if (!assets.length) return this.paths;
    await this.ensureDirectory();
    for (const asset of assets) {
      const filename = `imagen-${this.paths.size + 1}.${IMAGE_EXTENSIONS[asset.mime]}`;
      const FileClass = this.env.File ?? globalThis.File;
      const file = new FileClass([imageBytes(asset)], filename, { type: asset.mime });
      const result = await this.env.FilePicker.upload("data", this.directory, file, {}, { notify: false });
      if (!result || result.error || typeof result.path !== "string" || !result.path.trim() || /^(?:javascript|data|blob):/i.test(result.path)) {
        throw new Error(`No se pudo subir ${asset.id}: ${result?.error ?? "Foundry no devolvió la ruta del archivo"}.`);
      }
      this.paths.set(asset.id, result.path);
      this.uploaded.push(result.path);
    }
    return this.paths;
  }
}
