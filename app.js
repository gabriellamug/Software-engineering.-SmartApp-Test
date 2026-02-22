const $ = (s) => document.querySelector(s);

let settings = { mockMode: true, apiBaseUrl: "http://localhost:8000" };

let state = {
  request: null,
  generated: null,   // { code, validated: true }
  result: null       // { output }
};

function setChip(active) {
  $("#chip1").classList.toggle("active", active === 1);
  $("#chip2").classList.toggle("active", active === 2);
  $("#chip3").classList.toggle("active", active === 3);
}

function showStep(n) {
  $("#step1").classList.toggle("hidden", n !== 1);
  $("#step2").classList.toggle("hidden", n !== 2);
  $("#step3").classList.toggle("hidden", n !== 3);
  setChip(n);
}

function setDot(dotId, kind) {
  const el = $(dotId);
  el.classList.remove("good","warn","bad");
  if (kind) el.classList.add(kind);
}

function uid() {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

/** API wrapper (mock by default) */
async function apiFetch(path, { method="GET", body=null } = {}) {
  if (settings.mockMode) return mockApi(path, { method, body });

  const url = `${settings.apiBaseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type":"application/json" },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function mockApi(path, { method, body }) {
  await sleep(300 + Math.random()*400);
  return { ok: true, path, method, body };
}

/** Step 1 */
async function createRequest() {
  const appName = $("#appName").value.trim();
  const platform = $("#platform").value;
  const feature = $("#feature").value.trim();
  const requirements = $("#requirements").value.trim();

  if (!appName || !feature || !requirements) {
    $("#requestNote").textContent = "Please fill App name, Feature, and Requirements.";
    return;
  }

  const req = { id: uid(), appName, platform, feature, requirements, createdAt: Date.now() };
  state.request = req;

  await apiFetch("/requests", { method:"POST", body: req });

  $("#requestNote").textContent = `✅ Request created: #${req.id} (${req.appName} → ${req.feature})`;
  $("#genDetails").textContent = `Ready to generate tests for: ${req.appName} / ${req.feature}`;
  $("#generateBtn").disabled = false;

  showStep(2);
}

/** Step 2 */
async function generateTests() {
  if (!state.request) return;

  $("#generateBtn").disabled = true;
  setDot("#dotGen", "warn");
  $("#genStatus").textContent = "Generating…";
  $("#genDetails").textContent = "Collecting context → generating tests → validating…";

  // simulate phases
  await apiFetch("/orchestrator/context", { method:"POST", body:{ requestId: state.request.id } });
  await sleep(500);

  await apiFetch("/orchestrator/generate", { method:"POST", body:{ requestId: state.request.id } });
  await sleep(700);

  await apiFetch("/orchestrator/validate", { method:"POST", body:{ requestId: state.request.id } });
  await sleep(500);

  const code =
`// ${state.request.platform === "android" ? "Espresso" : "Appium"} tests (mock)
describe("${state.request.appName} - ${state.request.feature}", () => {
  it("happy path", async () => { /* open app → do steps → assert */ });
  it("invalid input", async () => { /* error message shown */ });
  it("edge case", async () => { /* empty fields / network loss */ });
});`;

  state.generated = { code, validated: true };

  $("#preview").textContent = code;
  setDot("#dotGen", "good");
  $("#genStatus").textContent = "Ready for approval";
  $("#genDetails").textContent = "✅ Tests generated and validated. Continue to approve & run.";
  $("#goTo3").disabled = false;

  $("#approveBtn").disabled = false;
  $("#rejectBtn").disabled = false;
}

/** Step 3 */
async function approveAndRun() {
  if (!state.generated?.validated) return;

  setDot("#dotRun", "warn");
  $("#runStatus").textContent = "Running…";
  $("#runDetails").textContent = "Executing tests and creating report…";
  $("#output").textContent = "Starting execution...\n";

  await apiFetch("/orchestrator/execute", { method:"POST", body:{ requestId: state.request.id } });
  await sleep(900);

  const output =
`Device: ${state.request.platform === "android" ? "Android Emulator (API 34)" : "Device Farm"}
Result: Completed (mock)
- Passed: 10
- Failed: 0
Coverage: 84%

Notes:
- If you connect a real backend, this section will show real logs/results.`;

  state.result = { output };
  $("#output").textContent = output;

  setDot("#dotRun", "good");
  $("#runStatus").textContent = "Completed";
  $("#runDetails").textContent = "✅ Test run finished. See output below.";
}

function reject() {
  setDot("#dotRun", "bad");
  $("#runStatus").textContent = "Rejected";
  $("#runDetails").textContent = "You rejected the generated tests. Go back and adjust requirements.";
  $("#output").textContent = "Rejected by user. No execution performed.";
}

function resetAll() {
  state = { request:null, generated:null, result:null };

  $("#appName").value = "";
  $("#feature").value = "";
  $("#requirements").value = "";
  $("#platform").value = "android";

  $("#requestNote").textContent = "";
  $("#preview").textContent = "Nothing generated yet.";
  $("#output").textContent = "No output yet.";

  setDot("#dotGen", null);
  setDot("#dotRun", null);

  $("#genStatus").textContent = "Waiting";
  $("#genDetails").textContent = "Create a request first.";
  $("#runStatus").textContent = "Waiting";
  $("#runDetails").textContent = "Generate tests first.";

  $("#generateBtn").disabled = true;
  $("#goTo3").disabled = true;
  $("#approveBtn").disabled = true;
  $("#rejectBtn").disabled = true;

  showStep(1);
}

function toggleMode() {
  settings.mockMode = !settings.mockMode;
  $("#modePill").textContent = settings.mockMode ? "Mock Mode" : "Real API Mode";
}

function init() {
  $("#modePill").textContent = settings.mockMode ? "Mock Mode" : "Real API Mode";
  $("#toggleModeBtn").addEventListener("click", toggleMode);

  $("#createBtn").addEventListener("click", createRequest);
  $("#generateBtn").addEventListener("click", generateTests);

  $("#backTo1").addEventListener("click", () => showStep(1));
  $("#goTo3").addEventListener("click", () => showStep(3));
  $("#backTo2").addEventListener("click", () => showStep(2));

  $("#approveBtn").addEventListener("click", approveAndRun);
  $("#rejectBtn").addEventListener("click", reject);

  $("#newRequestBtn").addEventListener("click", resetAll);

  showStep(1);
}
document.addEventListener("DOMContentLoaded", init);
