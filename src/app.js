
"use strict";

/*
 London Underground Signal Simulator
 Open-source educational simulation.
 Not connected to real railway signalling systems.
*/

const LINE_DATA = {
  District: ["Ealing Broadway", "Ealing Common", "Acton Town", "Hammersmith", "Earl's Court", "Victoria", "Westminster", "Embankment"],
  Central: ["Ealing Broadway", "North Acton", "White City", "Notting Hill Gate", "Bond Street", "Oxford Circus", "Liverpool Street", "Stratford"],
  Victoria: ["Brixton", "Stockwell", "Vauxhall", "Victoria", "Green Park", "Oxford Circus", "Warren Street", "King's Cross"],
  Bakerloo: ["Elephant & Castle", "Lambeth North", "Waterloo", "Embankment", "Charing Cross", "Piccadilly Circus", "Oxford Circus", "Paddington"],
  Jubilee: ["Stratford", "Canary Wharf", "Canada Water", "London Bridge", "Waterloo", "Westminster", "Green Park", "Baker Street"]
};

const state = {
  line: "District",
  sections: [],
  trains: [],
  selected: 0,
  paused: false,
  scenario: "normal",
  tick: 0,
  nextTrain: 1,
  events: []
};

const $ = id => document.getElementById(id);

function log(message) {
  const time = new Date().toLocaleTimeString();
  state.events.unshift(`[${time}] ${message}`);
  state.events = state.events.slice(0, 35);
  $("log").innerHTML = state.events.map(x => `<div>${escapeHTML(x)}</div>`).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function makeLine(name) {
  state.line = name;
  state.trains = [];
  state.selected = 0;
  state.sections = LINE_DATA[name].slice(0, -1).map((station, i) => ({
    id: i,
    from: station,
    to: LINE_DATA[name][i + 1],
    occupied: false,
    blocked: false,
    route: false,
    signal: "red"
  }));
  log(`${name} line selected.`);
  render();
}

function addTrain() {
  if (state.trains.some(t => t.position === 0)) {
    log("Cannot introduce train: platform section occupied.");
    return;
  }

  const train = {
    id: state.nextTrain++,
    position: 0,
    destination: state.sections.length - 1
  };

  state.trains.push(train);
  state.sections[0].occupied = true;
  log(`Train LU${String(train.id).padStart(3, "0")} introduced.`);
  render();
}

function selectSection(id) {
  state.selected = id;
  renderInspector();
  renderDiagram();
}

function setRoute(id) {
  const section = state.sections[id];
  if (!section || section.blocked || section.occupied) {
    log("Route unavailable: section is blocked or occupied.");
    return;
  }

  section.route = true;
  section.signal = "green";
  log(`Route set: ${section.from} → ${section.to}.`);
  render();
}

function cancelRoute(id) {
  const section = state.sections[id];
  if (!section) return;

  section.route = false;
  section.signal = "red";
  log(`Route cancelled: ${section.from} → ${section.to}.`);
  render();
}

function renderDiagram() {
  const diagram = $("diagram");
  diagram.innerHTML = "";

  state.sections.forEach((section, i) => {
    const item = document.createElement("div");
    item.className = "line";

    const signalClass = section.blocked
      ? "blocked"
      : section.occupied
        ? "red"
        : section.route ? "proceed" : "";

    item.innerHTML = `
      <div class="station">${escapeHTML(section.from)}</div>
      <div class="track ${section.occupied ? "occupied" : ""} ${section.blocked ? "blocked" : ""} ${section.route ? "route" : ""}"></div>
      <button class="signal ${signalClass} ${state.selected === i ? "selected" : ""}"
        aria-label="Select signal ${i + 1}">
        ${section.signal === "green" && !section.occupied && !section.blocked ? "●" : "●"}
      </button>
      <div class="station">${escapeHTML(section.to)}</div>
    `;

    item.addEventListener("click", () => selectSection(i));
    diagram.appendChild(item);
  });
}

function renderInspector() {
  const s = state.sections[state.selected];
  if (!s) return;

  $("inspector").innerHTML = `
    <h3>Section ${s.id + 1}</h3>
    <p><strong>From:</strong> ${escapeHTML(s.from)}</p>
    <p><strong>To:</strong> ${escapeHTML(s.to)}</p>
    <p><strong>Track circuit:</strong> ${s.occupied ? "OCCUPIED" : "CLEAR"}</p>
    <p><strong>Signal aspect:</strong> ${s.blocked ? "FAILED" : s.occupied ? "RED" : s.route ? "GREEN" : "RED"}</p>
    <p><strong>Route:</strong> ${s.route ? "SET" : "NOT SET"}</p>
    <p><strong>Section status:</strong> ${s.blocked ? "BLOCKED" : "NORMAL"}</p>
    <div class="inspector-actions">
      <button id="set-route" ${s.blocked || s.occupied || s.route ? "disabled" : ""}>Set route</button>
      <button id="cancel-route" ${!s.route ? "disabled" : ""}>Cancel route</button>
    </div>
  `;

  $("set-route").addEventListener("click", () => setRoute(s.id));
  $("cancel-route").addEventListener("click", () => cancelRoute(s.id));
}

function updateMetrics() {
  $("trains").textContent = state.trains.length;
  $("routes").textContent = state.sections.filter(s => s.route).length;
  $("occupied").textContent = state.sections.filter(s => s.occupied).length;
  $("service").textContent = state.scenario.toUpperCase();
}

function renderRegister() {
  $("register").innerHTML = state.trains.length
    ? state.trains.map(t => {
        const s = state.sections[t.position];
        return `<div>LU${String(t.id).padStart(3, "0")} — ${escapeHTML(s ? s.from : "Complete")} — Section ${t.position + 1}</div>`;
      }).join("")
    : "<p>No trains currently running.</p>";
}

function render() {
  renderDiagram();
  renderInspector();
  renderRegister();
  updateMetrics();
}

function advanceSimulation() {
  if (state.paused) return;

  state.tick++;

  state.trains.slice().forEach(train => {
    const current = state.sections[train.position];
    const next = state.sections[train.position + 1];

    if (!current || !next) {
      state.trains = state.trains.filter(t => t !== train);
      log(`Train LU${String(train.id).padStart(3, "0")} completed its journey.`);
      return;
    }

    if (next.route && !next.occupied && !next.blocked) {
      current.occupied = false;
      next.occupied = true;
      train.position++;
      log(`Train LU${String(train.id).padStart(3, "0")} advanced to ${next.from}.`);
    }
  });

  render();
}

function setScenario(name) {
  state.scenario = name;

  state.sections.forEach(s => {
    s.blocked = false;
    if (!s.occupied) {
      s.route = false;
      s.signal = "red";
    }
  });

  if (name === "peak") {
    if (state.sections[2]) state.sections[2].occupied = true;
    log("Peak traffic scenario loaded.");
  } else if (name === "blocked") {
    if (state.sections[3]) state.sections[3].blocked = true;
    log("Blocked section scenario loaded.");
  } else if (name === "failure") {
    if (state.sections[1]) state.sections[1].blocked = true;
    log("Signal failure scenario loaded.");
  } else {
    log("Normal service scenario loaded.");
  }

  render();
}

$("line").addEventListener("change", e => makeLine(e.target.value));
$("spawn").addEventListener("click", addTrain);

$("pause").addEventListener("click", () => {
  state.paused = !state.paused;
  $("pause").textContent = state.paused ? "Resume" : "Pause";
  log(state.paused ? "Simulation paused." : "Simulation resumed.");
});

document.querySelectorAll("[data-scenario]").forEach(button => {
  button.addEventListener("click", () => setScenario(button.dataset.scenario));
});

function updateClock() {
  const minutes = Math.floor(state.tick / 2);
  const hours = 8 + Math.floor(minutes / 60);
  const mins = minutes % 60;
  $("clock").textContent =
    `${String(hours % 24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

makeLine("District");
addTrain();

setInterval(() => {
  advanceSimulation();
  updateClock();
}, 2000);

log("London Underground Signal Simulator started.");
