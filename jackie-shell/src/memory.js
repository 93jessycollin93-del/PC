const KEY = "jackie-purpose-memory";

export function remember(entry) {
  const current = loadMemory();
  const next = { ...entry, at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify([...current.slice(-11), next]));
  return next;
}

export function loadMemory() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
