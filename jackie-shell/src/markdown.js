function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function renderMarkdown(source) {
  const escaped = escapeHtml(String(source));
  const blocks = escaped.split(/```([\w-]*)\n?([\s\S]*?)```/g);
  return blocks.map((part, index) => {
    if (index % 3 === 2) return `<pre><code class="language-${blocks[index - 1] || "text"}">${part.trim()}</code></pre>`;
    if (index % 3 === 1) return "";
    return part.split("\n").map(line => {
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("> ")) return `<blockquote>${line.slice(2)}</blockquote>`;
      if (/^- /.test(line)) return `<li>${line.slice(2)}</li>`;
      return line.replace(/`([^`]+)`/g, "<code>$1</code>") || "<br>";
    }).join("\n").replace(/(<li>.*<\/li>\n?)+/g, list => `<ul>${list}</ul>`);
  }).join("");
}
