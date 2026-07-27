import { remember } from "./memory.js";
import { connectPurpose } from "./purposeGraph.js";
import { tuneBalance } from "./balanceTuner.js";
import { renderMarkdown } from "./markdown.js";

const $ = id => document.getElementById(id);
const form = $("composer"), input = $("message"), chat = $("chat"), welcome = $("welcome");
const energy = $("energy"), energyValue = $("energyValue");
const energyNames = ["quiet", "tender", "steady", "open", "charged"];

energy.addEventListener("input", () => { energyValue.textContent = energyNames[energy.value - 1]; });
$("menu").addEventListener("click", () => $("sidebar").classList.add("open"));
$("closeDrawer").addEventListener("click", () => $("sidebar").classList.remove("open"));
$("collapse").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
$("enterPlayground").addEventListener("click", event => {
  event.stopPropagation();
  $("landing").classList.add("hidden");
  setTimeout(() => $("landing").remove(), 550);
  input.focus();
});
$("landing").addEventListener("click", () => $("enterPlayground").click());
$("newThread").addEventListener("click", () => { chat.replaceChildren(); welcome.hidden = false; input.focus(); });
input.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit(); });

function addBubble(text, role, tools = false) {
  const bubble = document.createElement("article");
  bubble.className = `bubble ${role}`;
  bubble.innerHTML = role === "jackie" ? renderMarkdown(text) : renderMarkdown(text);
  if (tools) {
    const actions = document.createElement("div");
    actions.className = "message-tools";
    actions.innerHTML = "<button data-copy>Copy</button><button data-edit>Edit</button><button data-regenerate>Regenerate</button>";
    bubble.append(actions);
    actions.querySelector("[data-copy]").onclick = () => navigator.clipboard?.writeText(text);
    actions.querySelector("[data-edit]").onclick = () => { input.value = text; input.focus(); };
  }
  chat.append(bubble);
  bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return bubble;
}

async function answer(message, bubble) {
  const settings = tuneBalance(energy.value);
  const related = connectPurpose(message);
  const context = { message, balance: settings, related: related.length };
  remember({ goal: message, tone: settings.warmth });
  try {
    const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context) });
    if (!response.ok) throw new Error("offline");
    const data = await response.json();
    bubble.className = "bubble jackie";
    bubble.innerHTML = renderMarkdown(data.message);
    const tools = document.createElement("div");
    tools.className = "message-tools";
    tools.innerHTML = "<button data-copy>Copy</button>";
    tools.querySelector("button").onclick = () => navigator.clipboard?.writeText(data.message);
    bubble.append(tools);
  } catch {
    // Static hosting has no proxy; this gentle fallback keeps the shell usable offline.
    bubble.className = "bubble jackie";
    bubble.innerHTML = renderMarkdown("I’m in **quiet mode** here. Your thought is held safely; when a backend is connected, I can meet it with a live response.");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  welcome.hidden = true; input.value = "";
  addBubble(message, "user", true);
  const bubble = addBubble("Thinking <span></span><span></span><span></span>", "jackie");
  bubble.classList.add("thinking");
  await answer(message, bubble);
  $("frameStatus").textContent = "— PRESENT";
  $("synchLog").innerHTML = `Synchronicity log <span>·</span> thread gently added`;
});
