export function $(id) {
  return document.getElementById(id);
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function withPeriod(name) {
  const clean = String(name).replace(/\.$/, "");
  return clean + ".";
}
