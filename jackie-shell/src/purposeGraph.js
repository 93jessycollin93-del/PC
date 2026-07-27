import { loadMemory } from "./memory.js";

export function connectPurpose(message) {
  const words = new Set(message.toLowerCase().match(/[a-z]{4,}/g) || []);
  return loadMemory().filter(item => {
    const prior = new Set((item.goal || "").toLowerCase().match(/[a-z]{4,}/g) || []);
    return [...words].some(word => prior.has(word));
  }).slice(-3);
}
