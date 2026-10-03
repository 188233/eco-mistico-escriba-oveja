export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
export function literal(text) {
  return escapeHtml(text).replace(/@/g, "@\u200b").replace(/\[\[/g, "[\u200b[");
}
export function toHtml(text) {
  return literal(text).split(/\r?\n\s*\r?\n/).map(part => `<p>${part.replace(/\r?\n/g, "<br>")}</p>`).join("\n");
}
