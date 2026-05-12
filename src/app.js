const ACTION_RE = /^(\s*(?:-\s+)?uses:\s*)([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)((?:\/[A-Za-z0-9._-]+)*)@([^\s#]+)(.*)$/gm;
const SHA_RE = /^[0-9a-f]{40}$/;

async function fetchLatest(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const when = reset ? ` Resets at ${new Date(reset * 1000).toLocaleTimeString()}.` : "";
    throw new Error(`rate limited${when}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (!data.tag_name) throw new Error("no releases");

  return data.tag_name;
}

function parseActions(text) {
  const found = [];
  for (const match of text.matchAll(ACTION_RE)) {
    const [, , ownerRepo, , ref] = match;
    found.push({ ownerRepo, ref, sha: SHA_RE.test(ref) });
  }
  return found;
}

async function upgrade() {
  const btn = document.getElementById("upgrade");
  const copyBtn = document.getElementById("copy");
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  let text = document.getElementById("input").value;

  const found = parseActions(text);
  if (found.length === 0) {
    statusEl.hidden = false;
    statusEl.innerHTML = '<div class="err">No actions found.</div>';
    return;
  }

  const repos = new Map();
  const skipped = [];

  for (const { ownerRepo, ref, sha } of found) {
    if (sha) {
      if (!skipped.includes(ownerRepo)) skipped.push(ownerRepo);
    } else if (!repos.has(ownerRepo)) {
      repos.set(ownerRepo, ref);
    }
  }

  const toFetch = [...repos.keys()];

  btn.disabled = true;
  btn.textContent = `Checking ${toFetch.length + skipped.length} action${toFetch.length + skipped.length > 1 ? "s" : ""}...`;
  statusEl.hidden = false;
  statusEl.innerHTML = "";
  outputEl.value = "";
  copyBtn.disabled = true;

  const results = await Promise.allSettled(toFetch.map(async (repo) => {
    const tag = await fetchLatest(repo);
    return { repo, tag };
  }));

  const updated = [];
  const failed = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      const { repo, tag } = result.value;
      const current = repos.get(repo);
      if (current !== tag) {
        updated.push({ repo, from: current, to: tag });
      }
    } else {
      failed.push({ repo: toFetch[i], reason: result.reason.message });
    }
  }

  for (const { repo, to } of updated) {
    const re = new RegExp(
      `^(\\s*(?:-\\s+)?uses:\\s*${escapeRegex(repo)}(?:\\/[A-Za-z0-9._-]+)*)@(?![0-9a-f]{40}\\b)[^\\s#]+`,
      "gm"
    );
    text = text.replace(re, `$1@${to}`);
  }

  outputEl.value = text;
  copyBtn.disabled = false;
  btn.disabled = false;
  btn.textContent = "Upgrade";

  const lines = [];
  const total = toFetch.length + skipped.length;
  const alreadyLatest = toFetch.length - updated.length - failed.length;

  lines.push(`<div class="summary">${total} action${total > 1 ? "s" : ""} found</div>`);
  for (const u of updated) lines.push(`<div class="ok">${u.repo}: ${u.from} -> ${u.to}</div>`);
  if (alreadyLatest > 0) lines.push(`<div class="ok">${alreadyLatest} already on latest</div>`);
  for (const f of failed) lines.push(`<div class="err">${f.repo}: ${f.reason}</div>`);
  for (const s of skipped) lines.push(`<div class="skip">${s}: skipped (SHA-pinned)</div>`);

  statusEl.innerHTML = lines.join("");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

document.getElementById("upgrade").addEventListener("click", upgrade);
document.getElementById("copy").addEventListener("click", () => {
  const output = document.getElementById("output");
  navigator.clipboard.writeText(output.value);
  const btn = document.getElementById("copy");
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = "Copy"; }, 1500);
});
