export function object(value, path, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: se esperaba un objeto.`);
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`${path}: campos desconocidos: ${extra.join(", ")}.`);
  return value;
}
export function string(value, path, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${path}: debe ser texto no vacío de hasta ${max} caracteres.`);
  return value.trim();
}
export function id(value, path) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) throw new Error(`${path}: usá minúsculas, números, guiones o guiones bajos (máximo 80 caracteres).`);
  return value;
}
export function visibility(config, path, dm = false) {
  object(config, path, ["visibilidad"]);
  const value = config.visibilidad === undefined ? "gm" : config.visibilidad;
  if (!["gm", "jugadores"].includes(value)) throw new Error(`${path}.visibilidad: debe ser gm o jugadores.`);
  if (dm && value !== "gm") throw new Error(`${path}: una nota del DM y sus variaciones deben ser privadas (gm).`);
  return { visibilidad: value };
}
export function array(value, path, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${path}: incluí entre ${min} y ${max} elementos.`);
  return value;
}
