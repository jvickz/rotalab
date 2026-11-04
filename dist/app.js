import { scenarioFromSearch } from "./laboratory.js";
import { mountLaboratory } from "./laboratory-ui.js";
import {
  DEPOT,
  COLORS,
  km,
  travel,
  scenario,
  baseline,
  summarize,
  seeded,
  createOptimizer,
} from "./planner.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const paths = {
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5z M9 3v16 M15 5v16",
  chart: "M4 3v17h17 M8 15v-4 M13 15V7 M18 15V4",
  layers: "M12 3L2 8l10 5 10-5-10-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  help: "M9 9a3 3 0 115 2c-1 1-2 1-2 3 M12 17h.01 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  shuffle:
    "M3 6h3c5 0 7 12 12 12h3 M17 14l4 4-4 4 M3 18h3c2 0 4-3 5-6 M14 8c1-1 2-2 4-2h3 M17 2l4 4-4 4",
  package: "M3 7l9-5 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7 4l10 5",
  route:
    "M5 4a2 2 0 110 4 2 2 0 010-4 M19 16a2 2 0 110 4 2 2 0 010-4 M5 8v5a4 4 0 004 4h6 M19 16V9a3 3 0 00-3-3h-5",
  clock: "M12 7v6l4 2 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
  truck:
    "M2 6h12v11H2V6z M14 10h4l4 4v3h-8 M6 20a2 2 0 100-4 2 2 0 000 4 M18 20a2 2 0 100-4 2 2 0 000 4",
  sun: "M12 8a4 4 0 110 8 4 4 0 010-8 M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z",
  cursor: "M4 3l6 17 3-7 7-3L4 3z",
  play: "M8 4l12 8-12 8V4z",
  pause: "M8 4v16 M16 4v16",
  reset: "M3 10a9 9 0 119 11 M3 3v7h7",
  focus: "M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M9 12h6 M12 9v6",
  traffic: "M8 2h8v20H8V2z M12 6h.01 M12 12h.01 M12 18h.01",
  warning: "M12 3L1 21h22L12 3z M12 9v5 M12 18h.01",
  cancel: "M8 8l8 8 M16 8l-8 8 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
  check: "M5 12l4 4L20 5",
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.map}"/></svg>`;
}
function fillIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
fillIcons();
const fmt = (n, d = 1) =>
  Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const time = (t) =>
  `${String(8 + Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
let optimizer = null,
  engineFailed = false,
  engineMS = 0,
  toastTimer = null,
  renderStamp = -1;
let state = {
  ...scenario("pico", 42),
  clock: 0,
  playing: false,
  speed: 2,
  strategy: "baseline",
  selectedVehicle: 1,
  selectedOrder: null,
  events: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  finished: false,
};
const point = (o) => ({ x: 30 + o.x * 30, y: 25 + o.y * 27 });
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3600);
}
function log(title, body, type = "info") {
  state.events.unshift({ time: state.clock, title, body, type });
  if (state.events.length > 80) state.events.pop();
  renderEvents();
}
function pending() {
  return state.orders.filter((o) => o.status === "pending");
}
function planningOrders() {
  return pending().map((o) => {
    let service = o.remainingService ?? o.service;
    for (const v of state.vehicles) {
      const t = v.tasks?.[v.taskIndex];
      if (t?.type === "service" && t.id === o.id)
        service = Math.max(0, t.duration - v.taskElapsed);
    }
    return { ...o, service };
  });
}
function currentPlan() {
  return state.vehicles.map((v) =>
    v.route.filter((id) =>
      state.orders.some((o) => o.id === id && o.status === "pending"),
    ),
  );
}
function currentStats() {
  return summarize(
    currentPlan(),
    planningOrders(),
    state.vehicles,
    state.clock,
    state.traffic,
  );
}
function bindRoutes(plan) {
  for (const o of pending()) o.assigned = null;
  state.vehicles.forEach((v, i) => {
    v.route = plan[i] || [];
    v.route.forEach((id) => {
      const o = state.orders.find((o) => o.id === id);
      if (o) o.assigned = v.id;
    });
  });
  rebuildTasks();
}
function routeGeometry(start, end, id = 0) {
  const a = point(start),
    b = point(end);
  return id % 2 ? [a, { x: a.x, y: b.y }, b] : [a, { x: b.x, y: a.y }, b];
}
function rebuildTasks() {
  for (const v of state.vehicles) {
    const task = v.tasks?.[v.taskIndex];
    if (task?.type === "service") {
      const o = state.orders.find((o) => o.id === task.id);
      if (o?.status === "pending")
        o.remainingService = Math.max(0, task.duration - v.taskElapsed);
    }
  }
  for (const v of state.vehicles) {
    v.tasks = [];
    v.taskIndex = 0;
    v.taskElapsed = 0;
    let pos = { ...v.pos };
    if (!v.active) continue;
    if (v.delay > 0) v.tasks.push({ type: "wait", duration: v.delay });
    for (const id of v.route) {
      const o = state.orders.find((o) => o.id === id && o.status === "pending");
      if (!o) continue;
      v.tasks.push({
        type: "travel",
        from: { ...pos },
        to: { x: o.x, y: o.y },
        duration: travel(pos, o, state.traffic),
        id,
      });
      v.tasks.push({
        type: "service",
        duration: o.remainingService ?? o.service,
        id,
      });
      pos = { x: o.x, y: o.y };
    }
    if (km(pos, DEPOT) > 0.001)
      v.tasks.push({
        type: "travel",
        from: { ...pos },
        to: { ...DEPOT },
        duration: travel(pos, DEPOT, state.traffic),
        id: 0,
      });
  }
  state.finished = false;
}
function calculateOptimized() {
  if (!optimizer) {
    toast("O motor C++ ainda está carregando. Tente novamente em instantes.");
    return null;
  }
  const delay = Math.max(0, ...state.vehicles.map((v) => v.delay || 0));
  const result = optimizer(
    planningOrders(),
    state.vehicles,
    state.clock + delay,
    state.traffic,
  );
  engineMS = result.milliseconds;
  return result.plan;
}
function applyStrategy(strategy, { quiet = false } = {}) {
  state.playing = false;
  state.strategy = strategy;
  $("#strategy").value = strategy;
  let plan;
  if (strategy === "optimized") plan = calculateOptimized();
  else if (strategy === "baseline") plan = baseline(pending(), state.vehicles);
  else plan = state.vehicles.map(() => []);
  if (!plan) return;
  bindRoutes(plan);
  if (!quiet) {
    if (strategy === "optimized") {
      log(
        "Rotas replanejadas pelo C++",
        `${pending().length} entregas pendentes · ${fmt(engineMS, 2)} ms de processamento.`,
      );
      toast(
        "Novo plano calculado. Compare as estratégias para ver o resultado.",
      );
    }
    if (strategy === "manual") {
      log(
        "Você assumiu o planejamento",
        "Selecione um veículo e clique nas entregas, na ordem desejada.",
      );
      toast("Plano manual: escolha um veículo e clique nas entregas do mapa.");
    }
  }
  render();
}
function newScenario(kind = state.kind, seed = state.seed) {
  const speed = state.speed;
  state = {
    ...scenario(kind, seed),
    clock: 0,
    playing: false,
    speed,
    strategy: "baseline",
    selectedVehicle: 1,
    selectedOrder: null,
    events: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    finished: false,
  };
  bindRoutes(baseline(pending(), state.vehicles));
  $("#strategy").value = "baseline";
  $("#map-tip").classList.remove("hidden");
  $("#order-filter").value = "all";
  log(
    "Operação criada",
    `${state.orders.length} entregas · semente ${seed} · três veículos disponíveis.`,
  );
  renderStamp = -1;
  render();
}
function drawCity() {
  const r = seeded(420),
    parts = [];
  parts.push(
    '<rect width="900" height="610" fill="#eef0f2"/><rect width="900" height="610" fill="url(#grain)"/>',
  );
  parts.push(
    '<path d="M846-20Q817 90 856 196T854 395Q808 510 725 610H920V-20Z" fill="#dce6f2"/><path d="M845-20Q817 90 856 196T854 395Q808 510 725 610" fill="none" stroke="#bccde0" stroke-width="3"/>',
  );
  for (let x = 1; x <= 26; x++)
    for (let y = 1; y <= 19; y++) {
      const p = point({ x, y });
      if (p.x > 800 && y > 15) continue;
      const park =
        (x >= 2 && x <= 5 && y >= 3 && y <= 5) ||
        (x >= 18 && x <= 21 && y >= 12 && y <= 14);
      const colors = park
        ? ["#d5e0c8", "#cbdcbd", "#d9e4ce"]
        : ["#e1e4e9", "#e7e9ec", "#dce0e5", "#e3e6eb"];
      parts.push(
        `<rect x="${p.x + 4}" y="${p.y + 4}" width="${19 + r() * 4}" height="${16 + r() * 3}" rx="${park ? 5 : 2}" fill="${colors[Math.floor(r() * colors.length)]}"/>`,
      );
      if (park && r() > 0.3)
        parts.push(
          `<circle cx="${p.x + 12}" cy="${p.y + 12}" r="5" fill="#c3d6b7"/><circle cx="${p.x + 19}" cy="${p.y + 19}" r="4" fill="#c3d6b7"/>`,
        );
    }
  for (let x = 1; x <= 27; x++) {
    const p = point({ x, y: 0 });
    const major = x % 5 === 4;
    parts.push(
      `<path d="M${p.x} 0V610" stroke="${major ? "#d6dbe2" : "#e1e5ea"}" stroke-width="${major ? 11 : 7}"/><path d="M${p.x} 0V610" stroke="${major ? "#ffffff" : "#f9fafc"}" stroke-width="${major ? 8 : 5}"/>`,
    );
  }
  for (let y = 1; y <= 20; y++) {
    const p = point({ x: 0, y });
    const major = y % 5 === 4;
    parts.push(
      `<path d="M0 ${p.y}H840" stroke="${major ? "#d6dbe2" : "#e1e5ea"}" stroke-width="${major ? 12 : 7}"/><path d="M0 ${p.y}H840" stroke="${major ? "#ffffff" : "#f9fafc"}" stroke-width="${major ? 9 : 5}"/>`,
    );
  }
  parts.push(
    '<path d="M5 550H640Q765 550 830 460" fill="none" stroke="#d1d7ca" stroke-width="7"/><path d="M5 550H640Q765 550 830 460" fill="none" stroke="#ffffff" stroke-width="4"/>',
  );
  parts.push(
    '<text class="district-label" x="315" y="160">VILA AURORA</text><text class="district-label" x="560" y="278">CENTRO</text><text class="district-label" x="106" y="470">JARDIM SUL</text><text class="district-label" x="557" y="495">PORTO NOVO</text><text class="road-label" x="70" y="259">AV. DAS PALMEIRAS</text><text class="road-label" x="440" y="393">AV. DO HORIZONTE</text><text class="road-label" x="390" y="77">RUA DO COMÉRCIO</text><text x="856" y="330" transform="rotate(-90 856 330)" font-size="12" font-family="Manrope,sans-serif" letter-spacing="5" fill="#8db7af">BAÍA CLARA</text>',
  );
  const d = point(DEPOT);
  parts.push(
    `<g class="map-depot" transform="translate(${d.x} ${d.y})"><rect x="-19" y="-19" width="38" height="38" rx="11" fill="#2455d6" stroke="white" stroke-width="3"/><path d="M-9 5V-4l9-6 9 6v9H-9M-4 5v-7h8v7" fill="none" stroke="white" stroke-width="1.7"/><rect x="-35" y="23" width="70" height="18" rx="5" fill="#2455d6"/><text text-anchor="middle" y="35">DEPÓSITO</text></g>`,
  );
  $("#city-base").innerHTML = parts.join("");
}
function drawRoutes() {
  let lines = "";
  state.vehicles.forEach((v) => {
    if (!v.active) return;
    const coords = [point(v.pos)];
    let pos = v.pos;
    for (const id of v.route) {
      const o = state.orders.find((o) => o.id === id && o.status === "pending");
      if (!o) continue;
      coords.push(...routeGeometry(pos, o, id).slice(1));
      pos = o;
    }
    if (coords.length < 2) return;
    coords.push(...routeGeometry(pos, DEPOT).slice(1));
    const d = coords.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    lines += `<path class="route-ghost" d="${d}"/><path class="map-route ${v.id === state.selectedVehicle ? "selected" : ""}" d="${d}" stroke="${v.color}"/>`;
  });
  $("#route-layer").innerHTML = lines;
}
function drawDeliveries() {
  $("#delivery-layer").innerHTML = state.orders
    .map((o) => {
      if (o.status === "cancelled") return "";
      const p = point(o),
        v = state.vehicles.find((v) => v.id === o.assigned),
        color = o.status === "delivered" ? "#63a785" : v?.color || "#9ba99e";
      return `<g class="delivery-marker" role="button" tabindex="0" aria-label="Entrega ${o.id}, ${o.name}, ${o.status === "delivered" ? "concluída" : "prazo " + time(o.deadline)}" data-order="${o.id}" transform="translate(${p.x} ${p.y})" opacity="${o.status === "delivered" ? 0.65 : 1}">${o.id === state.selectedOrder ? `<circle r="21" fill="${color}" opacity=".13"/>` : ""}<circle class="marker-core" r="12" fill="${o.status === "delivered" ? color : "white"}" stroke="${color}" stroke-width="2" filter="url(#pin-shadow)"/><text text-anchor="middle" dy="3.2" font-size="9" font-weight="700" fill="${o.status === "delivered" ? "white" : color}">${o.status === "delivered" ? "✓" : String(o.id).padStart(2, "0")}</text></g>`;
    })
    .join("");
}
function drawVehicles() {
  $("#vehicle-layer").innerHTML = state.vehicles
    .map((v) => {
      if (state.clock < 0.01 && v.active) return "";
      let p = point(v.pos);
      const task = v.tasks?.[v.taskIndex];
      let rot = 0;
      if (task?.type === "travel") {
        const a = task.from,
          b = task.to,
          t = v.taskElapsed / (task.duration || 1),
          mix = interpolateGrid(a, b, t, task.id);
        p = point(mix);
        const next = interpolateGrid(a, b, Math.min(1, t + 0.005), task.id);
        rot = (Math.atan2(next.y - mix.y, next.x - mix.x) * 180) / Math.PI;
      }
      const c = v.active ? v.color : "#b77c55";
      return `<g class="map-vehicle" transform="translate(${p.x} ${p.y})"><circle r="18" fill="white" opacity=".75"/><g transform="rotate(${rot})"><rect x="-11" y="-6" width="17" height="12" rx="3" fill="${c}" stroke="white" stroke-width="1.5"/><path d="M6-5h5l4 4v6H6Z" fill="${c}" stroke="white" stroke-width="1.5"/><path d="M8-3h2l2 3H8Z" fill="#ffffff99"/><path d="M-7-7h3M-7 7h3M7-6h3M7 6h3" stroke="#2e4941" stroke-width="2"/></g><text y="-23" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="8" font-weight="700" fill="${c}" stroke="white" stroke-width="3" paint-order="stroke">${v.active ? "V-0" + v.id : "PARADO"}</text></g>`;
    })
    .join("");
}
function interpolateGrid(a, b, t, id = 0) {
  t = Math.max(0, Math.min(1, t));
  const dx = Math.abs(a.x - b.x),
    dy = Math.abs(a.y - b.y),
    total = dx + dy;
  if (!total) return { ...b };
  const d = total * t;
  if (id % 2) {
    if (d <= dy) return { x: a.x, y: a.y + Math.sign(b.y - a.y) * d };
    return { x: a.x + Math.sign(b.x - a.x) * (d - dy), y: b.y };
  }
  if (d <= dx) return { x: a.x + Math.sign(b.x - a.x) * d, y: a.y };
  return { x: b.x, y: a.y + Math.sign(b.y - a.y) * (d - dx) };
}
function renderFleet(stats) {
  $("#fleet-list").innerHTML = state.vehicles
    .map((v, i) => {
      const s = stats.perVehicle[i];
      return `<button class="vehicle-card ${state.selectedVehicle === v.id ? "selected" : ""} ${v.active ? "" : "broken"}" style="--vehicle-color:${v.color}" data-vehicle="${v.id}" aria-pressed="${state.selectedVehicle === v.id}"><div class="vehicle-top"><span class="vehicle-symbol">${icon("truck")}</span><span class="vehicle-name">V-0${v.id} · ${v.name}<small>${v.active ? (s.count ? (state.clock > 0 ? "Rota restante · " : "Rota planejada · ") + fmt(s.distance) + " km" : state.finished ? "Retornou ao depósito" : "Sem pedidos atribuídos") : "Parado após incidente"}</small></span><span class="vehicle-count">${s.count} entregas</span></div><div class="vehicle-data"><span>Carga ${s.load}/${v.capacity}</span><div class="capacity-track"><span style="width:${(s.load / v.capacity) * 100}%"></span></div><span>${Math.round((s.load / v.capacity) * 100)}%</span></div></button>`;
    })
    .join("");
}
function renderSequence() {
  const v = state.vehicles.find((v) => v.id === state.selectedVehicle);
  if (!v) return;
  const route = v.route.filter((id) =>
    state.orders.some((o) => o.id === id && o.status === "pending"),
  );
  $("#route-sequence").innerHTML =
    `<div class="sequence-label">Sequência de V-0${v.id} <span>${route.length} pedido${route.length === 1 ? "" : "s"}</span></div><div class="sequence-stops"><span class="sequence-end">${state.clock > 0 ? "Posição atual" : "Depósito"}</span>${route.map((id) => `<span class="sequence-arrow">→</span><span class="sequence-order" style="--vehicle-color:${v.color}">#${String(id).padStart(2, "0")}</span>`).join("")}<span class="sequence-arrow">→</span><span class="sequence-end">Depósito</span></div>`;
}
function renderDetail(stats) {
  const o = state.orders.find((o) => o.id === state.selectedOrder);
  if (!o) {
    $("#selection-detail").innerHTML =
      icon("cursor") +
      "<span>Clique em um pedido no mapa ou na tabela para ver prazo, volumes e previsão.</span>";
    return;
  }
  const v = state.vehicles.find((v) => v.id === o.assigned),
    eta = o.arrived ?? stats.arrivals[o.id];
  $("#selection-detail").innerHTML =
    `${icon("package")}<div><strong>#${String(o.id).padStart(2, "0")} · ${o.name}</strong><br>${o.demand} ${o.demand === 1 ? "volume" : "volumes"} · atendimento de ${o.service} min<br>Prazo ${time(o.deadline)} · ${eta !== undefined ? "previsão " + time(eta) : "sem previsão"}<br>${v ? "V-0" + v.id + " · " + v.name : "Sem veículo atribuído"}${state.strategy === "manual" && o.status === "pending" ? `<br><button data-action="assign">Atribuir a V-0${state.selectedVehicle}</button>` : ""}</div>`;
}
function renderOrders(stats) {
  const filter = $("#order-filter").value;
  const list = state.orders.filter(
    (o) =>
      filter === "all" ||
      (filter === "unassigned"
        ? o.status === "pending" && !o.assigned
        : o.status === filter),
  );
  $("#orders-body").innerHTML = list.length
    ? list
        .map((o) => {
          const v = state.vehicles.find((v) => v.id === o.assigned),
            eta = o.arrived ?? stats.arrivals[o.id],
            late = eta !== undefined && eta > o.deadline;
          const status =
            o.status === "cancelled"
              ? ["cancelled", "Cancelada"]
              : o.status === "delivered"
                ? [
                    late ? "late" : "done",
                    late ? "Entregue · atraso" : "Concluída",
                  ]
                : !v
                  ? ["unassigned", "Sem veículo"]
                  : [
                      late ? "late" : "",
                      late ? "Risco de atraso" : "Planejada",
                    ];
          return `<tr class="order-row ${state.selectedOrder === o.id ? "selected" : ""}" data-order="${o.id}" tabindex="0" aria-label="Ver entrega ${o.id}"><td>#${String(o.id).padStart(2, "0")} · ${o.name}<small>${o.demand} ${o.demand === 1 ? "volume" : "volumes"} · ${o.service} min de atendimento</small></td><td>${v ? `<span class="vehicle-pill" style="--vehicle-color:${v.color}"><i></i>V-0${v.id}</span>` : "—"}</td><td>${time(o.deadline)}</td><td class="${late ? "late-time" : ""}">${eta !== undefined ? time(eta) : "—"}</td><td><span class="status-pill ${status[0]}">${status[1]}</span></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="5" class="empty-row">Nenhuma entrega neste filtro.</td></tr>';
  $("#orders-count").textContent = state.orders.filter(
    (o) => o.status !== "cancelled",
  ).length;
}
function renderEvents() {
  $("#event-log").innerHTML = state.events
    .map(
      (e) =>
        `<div class="log-item ${e.type === "warning" ? "warning" : ""}"><span class="log-time">${time(e.time)}</span><span class="log-icon">${icon(e.type === "warning" ? "warning" : e.type === "delivery" ? "check" : "route")}</span><div class="log-copy"><strong>${e.title}</strong><p>${e.body}</p></div></div>`,
    )
    .join("");
}
function render() {
  document.body.classList.toggle("is-running", state.playing);
  const stats = currentStats(),
    delivered = state.orders.filter((o) => o.status === "delivered"),
    all = state.orders.filter((o) => o.status !== "cancelled"),
    lateDone = delivered.filter((o) => o.arrived > o.deadline).length;
  $("#metric-delivered").textContent = delivered.length;
  $("#metric-total").textContent = "/ " + all.length;
  $("#delivery-tag").textContent = state.finished
    ? "Finalizada"
    : state.playing
      ? "Em andamento"
      : state.clock > 0
        ? "Pausada"
        : "Antes da saída";
  $("#delivery-caption").textContent = stats.unassigned
    ? `${stats.unassigned} entrega(s) sem veículo atribuído`
    : `${pending().length} entregas aguardando atendimento`;
  $("#metric-distance").textContent = fmt(
    stats.distance + state.vehicles.reduce((n, v) => n + v.traveled, 0),
  );
  $("#distance-caption").textContent =
    state.clock > 0
      ? "Percorrida + restante estimado"
      : "Trajeto completo, incluindo retorno";
  $("#metric-ontime").textContent = all.length
    ? Math.round(
        ((delivered.length - lateDone + stats.assigned - stats.late) /
          all.length) *
          100,
      )
    : 100;
  $("#ontime-tag").textContent = pending().length ? "Previsão" : "Resultado";
  $("#ontime-caption").textContent =
    `${stats.late + lateDone} em atraso${stats.unassigned ? " · " + stats.unassigned + " sem plano" : ""}`;
  $("#metric-fleet").textContent = state.vehicles.filter(
    (v) => v.active,
  ).length;
  $("#fleet-caption").textContent = state.vehicles.some((v) => !v.active)
    ? "Redistribuição em ponto de apoio"
    : "Capacidade monitorada por veículo";
  $("#clock").textContent = time(state.clock);
  $("#elapsed-label").textContent = Math.floor(state.clock) + " min simulados";
  $("#map-status").textContent = state.playing
    ? "Simulação em andamento"
    : state.finished
      ? "Ciclo encerrado"
      : state.clock > 0
        ? "Operação pausada"
        : state.strategy === "optimized"
          ? "Rotas otimizadas · prontas para sair"
          : state.strategy === "manual"
            ? "Modo manual · escolha as entregas"
            : "Plano inicial · aguardando saída";
  $("#simulation-label").textContent = state.playing
    ? "Operação em movimento"
    : state.finished
      ? "Simulação concluída"
      : state.clock > 0
        ? "Simulação pausada"
        : "Pronto para começar";
  $("#timeline-progress").style.width =
    Math.min(100, (state.clock / 360) * 100) + "%";
  $("#play").innerHTML =
    icon(state.playing ? "pause" : "play") +
    `<span>${state.playing ? "Pausar" : state.finished ? "Concluída" : state.clock > 0 ? "Continuar" : "Iniciar"}</span>`;
  $("#play").disabled = state.finished;
  $("#play").setAttribute(
    "aria-label",
    state.playing
      ? "Pausar simulação"
      : state.finished
        ? "Simulação concluída"
        : state.clock > 0
          ? "Continuar simulação"
          : "Iniciar simulação",
  );
  $("#strategy-description").textContent =
    state.strategy === "manual"
      ? "As rotas são limpas ao entrar neste modo. Selecione um veículo e clique nos pedidos na ordem de atendimento."
      : state.strategy === "optimized"
        ? "O planejador tenta reduzir o percurso e os atrasos, respeitando o limite de carga de cada veículo."
        : "Os pedidos são divididos entre os veículos na ordem de cadastro, respeitando o limite de carga. É o plano de referência.";
  $("#seed-label").textContent = "Cenário #" + state.seed;
  $("#scenario-caption").textContent =
    `Tempo de viagem +${Math.round((state.traffic - 1) * 100)}% · ${all.reduce((s, o) => s + o.demand, 0)} volumes`;
  $$("[data-scenario]").forEach((b) =>
    b.classList.toggle("selected", b.dataset.scenario === state.kind),
  );
  $$("[data-speed]").forEach((b) =>
    b.classList.toggle("selected", +b.dataset.speed === state.speed),
  );
  $("#engine-status").textContent = optimizer
    ? `Planejador disponível${engineMS ? " · cálculo em " + fmt(engineMS, 2) + " ms" : ""}`
    : engineFailed
      ? "Motor indisponível · recarregue a página"
      : "Preparando o planejador…";
  $("#map-scene").setAttribute(
    "transform",
    `translate(${450 * (1 - state.zoom) + state.pan.x} ${305 * (1 - state.zoom) + state.pan.y}) scale(${state.zoom})`,
  );
  renderFleet(stats);
  renderSequence();
  renderDetail(stats);
  renderOrders(stats);
  drawRoutes();
  drawDeliveries();
  drawVehicles();
}
function advanceVehicle(v, dt, startClock) {
  if (!v.active) return;
  let remaining = dt,
    spent = 0;
  while (remaining > 0.00001 && v.taskIndex < v.tasks.length) {
    const task = v.tasks[v.taskIndex],
      left = Math.max(0, task.duration - v.taskElapsed),
      step = Math.min(remaining, left);
    v.taskElapsed += step;
    remaining -= step;
    spent += step;
    if (task.type === "travel") {
      v.pos = interpolateGrid(
        task.from,
        task.to,
        task.duration ? v.taskElapsed / task.duration : 1,
        task.id,
      );
      v.traveled += task.duration
        ? (km(task.from, task.to) * step) / task.duration
        : 0;
    }
    if (task.type === "wait") v.delay = Math.max(0, v.delay - step);
    if (v.taskElapsed >= task.duration - 0.00001) {
      if (task.type === "service") {
        const o = state.orders.find((o) => o.id === task.id);
        if (o?.status === "pending") {
          o.status = "delivered";
          o.arrived = startClock + spent;
          log(
            `Entrega #${String(o.id).padStart(2, "0")} concluída`,
            `${o.name} · ${o.arrived > o.deadline ? "fora do prazo" : "no prazo"} · V-0${v.id}.`,
            "delivery",
          );
        }
      }
      if (task.type === "travel") v.pos = { ...task.to };
      v.taskIndex++;
      v.taskElapsed = 0;
    }
  }
}
let previous = performance.now();
function tick(now) {
  const real = Math.min((now - previous) / 1000, 0.15);
  previous = now;
  if (state.playing) {
    const dt = real * state.speed * 2,
      start = state.clock;
    state.clock += dt;
    for (const v of state.vehicles) advanceVehicle(v, dt, start);
    if (
      state.vehicles.every((v) => !v.active || v.taskIndex >= v.tasks.length)
    ) {
      state.playing = false;
      state.finished = true;
      log(
        "Ciclo da operação encerrado",
        `${state.orders.filter((o) => o.status === "delivered").length} entregas concluídas · ${pending().length} pendentes.`,
      );
      toast(
        "Ciclo concluído. Confira os resultados ou teste outra estratégia.",
      );
      render();
    } else if (Math.floor(state.clock) !== renderStamp) {
      renderStamp = Math.floor(state.clock);
      render();
    } else drawVehicles();
  }
  requestAnimationFrame(tick);
}
function selectOrder(id) {
  state.selectedOrder = id;
  if (
    state.strategy === "manual" &&
    state.orders.find((o) => o.id === id)?.status === "pending"
  )
    assignManual(id);
  else render();
}
function assignManual(id) {
  if (state.playing) {
    toast("Pause a simulação para alterar o planejamento manual.");
    return;
  }
  const v = state.vehicles.find((v) => v.id === state.selectedVehicle),
    o = state.orders.find((o) => o.id === id);
  if (!v?.active || o?.status !== "pending") {
    toast("Escolha um veículo disponível e uma entrega pendente.");
    return;
  }
  const load = v.route
    .filter((i) => i !== id)
    .reduce(
      (n, id) =>
        n +
        (state.orders.find((o) => o.id === id && o.status === "pending")
          ?.demand || 0),
      0,
    );
  if (load + o.demand > v.capacity) {
    toast("A capacidade deste veículo seria excedida. Escolha outro.");
    return;
  }
  state.vehicles.forEach((v) => (v.route = v.route.filter((i) => i !== id)));
  v.route.push(id);
  o.assigned = v.id;
  rebuildTasks();
  render();
}
function replanIncident() {
  if (state.strategy === "optimized" && optimizer)
    bindRoutes(calculateOptimized());
  else bindRoutes(baseline(pending(), state.vehicles));
  if (state.strategy === "manual") {
    state.strategy = "baseline";
    $("#strategy").value = "baseline";
    toast(
      "Incidente: plano de referência recalculado. Você pode assumir o modo manual.",
    );
  }
}
function incident(type) {
  if (!pending().length) {
    toast("Reinicie o cenário para introduzir novos eventos.");
    return;
  }
  if (type === "traffic") {
    state.traffic =
      state.traffic >= 2.3 ? 1 : Math.min(2.4, state.traffic + 0.45);
    replanIncident();
    log(
      "Condição de tráfego alterada",
      `Tempo de deslocamento: ${fmt(state.traffic, 2)}× o nominal. Rotas recalculadas.`,
      "warning",
    );
    toast("Tráfego alterado. Observe a projeção de entregas no prazo.");
  }
  if (type === "breakdown") {
    const active = state.vehicles.filter((v) => v.active);
    if (active.length <= 1) {
      toast("Mantenha ao menos um veículo ativo para continuar a simulação.");
      return;
    }
    const v = active.find((v) => v.id === state.selectedVehicle) || active[0];
    v.active = false;
    v.route = [];
    state.vehicles.filter((v) => v.active).forEach((v) => (v.delay += 8));
    state.selectedVehicle = state.vehicles.find((v) => v.active).id;
    replanIncident();
    log(
      `V-0${v.id} indisponível`,
      `Redistribuição no apoio: +8 min para a frota ativa. Entregas excedentes podem ficar sem veículo.`,
      "warning",
    );
    toast("Veículo parado. A frota disponível recebeu um novo plano.");
  }
  if (type === "cancel") {
    const o =
      pending().find((o) => o.id === state.selectedOrder) || pending().at(-1);
    o.status = "cancelled";
    state.vehicles.forEach(
      (v) => (v.route = v.route.filter((id) => id !== o.id)),
    );
    replanIncident();
    log(
      `Entrega #${String(o.id).padStart(2, "0")} cancelada`,
      `${o.name} removida do planejamento. Indicadores recalculados.`,
      "warning",
    );
    toast("Entrega cancelada e rotas recalculadas.");
  }
  state.finished = false;
  render();
}
function openModal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").showModal();
}
function showComparison() {
  if (!optimizer) {
    toast("Aguarde o carregamento do motor C++.");
    return;
  }
  // Keep the displayed snapshot and the accepted plan on the same clock.
  state.playing = false;
  render();
  const orders = planningOrders(),
    vehicles = state.vehicles,
    reference = baseline(orders, vehicles),
    opt = calculateOptimized();
  const a = summarize(reference, orders, vehicles, state.clock, state.traffic),
    b = summarize(opt, orders, vehicles, state.clock, state.traffic);
  const diff = a.distance - b.distance,
    pct = a.distance ? (diff / a.distance) * 100 : 0;
  function card(name, s, featured = false) {
    return `<article class="comparison-card ${featured ? "featured" : ""}"><h3>${name}</h3><dl><dt>Distância restante + retorno</dt><dd>${fmt(s.distance)} km</dd><dt>Entregas no prazo</dt><dd>${s.onTime}%</dd><dt>Entregas atrasadas</dt><dd>${s.late}</dd><dt>Sem veículo</dt><dd>${s.unassigned}</dd><dt>Último retorno previsto</dt><dd>${time(s.finish)}</dd></dl></article>`;
  }
  openModal(
    `<div class="modal-eyebrow">Comparação nas mesmas condições</div><h2>Comparação de rotas</h2><p>Comparação das <strong>${orders.length} entregas pendentes</strong>, a partir de ${time(state.clock)}, com as posições, capacidades e trânsito atuais. Os resultados são projeções do simulador.</p><div class="comparison-cards">${card("Ordem de cadastro", a)}${card("Planejamento automático", b, true)}</div><div class="comparison-summary">${diff >= 0 ? `O plano automático percorre <strong>${fmt(diff)} km a menos (${fmt(pct)}%)</strong>.` : `O plano automático percorre <strong>${fmt(-diff)} km a mais</strong>; a função objetivo também penaliza atrasos e desequilíbrio entre rotas.`}<br>${b.onTime - a.onTime >= 0 ? "+" : ""}${b.onTime - a.onTime} pontos percentuais de entregas no prazo nesta comparação.</div><p class="modal-note">A heurística não garante a melhor solução global, nem melhoria em todas as métricas. A distância é calculada em malha ortogonal, a 250 m por unidade. Capacidade limitada a cada ciclo de planejamento; redistribuições após incidentes incluem oito minutos de apoio.</p><button class="primary" id="apply-compared">Usar as rotas automáticas ${icon("route")}</button>`,
  );
  $("#apply-compared").onclick = () => {
    $("#modal").close();
    applyStrategy("optimized");
  };
}
function showMetricHelp(metric) {
  const items = {
    deliveries: [
      "Entregas concluídas",
      "Conta os pedidos cujo atendimento terminou. O número depois da barra é o total de pedidos ativos. Cancelamentos saem desse total. Um pedido sem veículo continua pendente.",
    ],
    distance: [
      "Distância do trajeto",
      "Antes da saída, mostra o percurso previsto, incluindo o retorno ao depósito. Durante a operação, soma a distância já percorrida com o caminho restante do plano atual. As ruas seguem uma malha fictícia: cada unidade equivale a 250 metros.",
    ],
    ontime: [
      "Entregas no prazo",
      "Um pedido é pontual quando o atendimento termina até o prazo informado. Antes de concluir a operação, o indicador combina os atendimentos realizados com a previsão dos pedidos pendentes. Pedidos sem rota contam como não atendidos no prazo. No fim do ciclo, o valor passa a ser o resultado observado.",
    ],
    fleet: [
      "Frota disponível e capacidade",
      "O numerador conta veículos disponíveis. Um veículo parado por incidente deixa de receber pedidos. A carga de cada rota é medida em volumes e precisa caber no veículo. Após uma indisponibilidade, a redistribuição é representada por oito minutos de apoio para a frota ativa.",
    ],
  };
  const item = items[metric];
  if (!item) return;
  openModal(
    `<div class="modal-eyebrow">Como ler o painel</div><h2>${item[0]}</h2><p>${item[1]}</p><p class="modal-note">Todos os valores são calculados a partir do cenário atual. O modelo não usa trânsito nem geografia reais.</p>`,
  );
}
function showHelp() {
  openModal(
    `<div class="modal-eyebrow">PORTFÓLIO · JOÃO VITOR MARINHO</div><h2>Como usar o RotaLab</h2><p>O RotaLab permite comparar formas de distribuir e atender pedidos de entrega. A cidade, os pedidos e os incidentes são fictícios. Cada semente recria exatamente o mesmo cenário.</p><h3>Planejar, acompanhar e comparar</h3><ol><li>Escolha um cenário e compare a ordem de cadastro com a heurística C++. No modo manual, selecione um veículo e clique nas entregas para definir a sequência.</li><li>Dê o play, ajuste a velocidade ou pause para observar a operação. O relógio representa minutos simulados.</li><li>Introduza trânsito, indisponibilidade de veículo ou cancelamento. Compare novamente a partir do estado atual.</li></ol><h3>O que significam os números no mapa?</h3><p>Cada número identifica um pedido e corresponde a uma linha da tabela. Ele não indica a ordem de visita. Para ver essa ordem, selecione um veículo e consulte sua sequência de atendimento. Cada cor representa um veículo.</p><h3>Como o planejamento automático funciona</h3><p>O código C++ é compilado para WebAssembly e executado no navegador. Ordena pedidos por prazo, encontra inserções que respeitam a capacidade e faz busca local com reversões e transferências entre rotas. A função de custo considera distância, atraso e duração das rotas. Não há garantia de ótimo global.</p><h3>Premissas explícitas</h3><ul><li>Malha ortogonal fictícia: 250 m por unidade; velocidade nominal de 26 km/h; o fator de trânsito multiplica o tempo de deslocamento.</li><li>O prazo se refere ao fim do atendimento. Cada pedido informa volumes, prazo e tempo de serviço.</li><li>O trajeto inclui retorno ao depósito. A previsão considera as posições atuais e os atendimentos pendentes.</li><li>Após uma indisponibilidade, o modelo abstrai a transferência física de carga como um apoio de oito minutos para a frota ativa. Capacidade é verificada para o próximo ciclo de entregas.</li><li>Cancelamentos retiram pedidos do denominador de pontualidade. Pedidos sem veículo contam como não atendidos no prazo projetado.</li><li>O painel é um experimento sintético, sem conexão com trânsito, geografia, emissões ou custos reais.</li></ul><h3>Uma comparação que pode ser reproduzida</h3><p>As duas estratégias recebem os mesmos pedidos, capacidades, posições, horário e fator de tráfego. Exporte o cenário para registrar o estado observado. A implementação, os testes e o experimento Python fazem parte do projeto.</p><p class="modal-note">JavaScript na interface · C++ no planejador · WebAssembly na execução · Python nos experimentos. Atalhos: espaço para iniciar/pausar, O para otimizar e C para comparar.</p>`,
  );
}
$("#play").onclick = () => {
  if (state.finished) {
    toast("Reinicie o cenário ou altere o plano para simular novamente.");
    return;
  }
  if (!state.vehicles.some((v) => v.active && v.taskIndex < v.tasks.length)) {
    toast("Atribua entregas aos veículos antes de iniciar.");
    return;
  }
  state.playing = !state.playing;
  $("#map-tip").classList.add("hidden");
  if (state.playing && state.clock === 0)
    log(
      "Frota liberada para operação",
      "Acompanhe o atendimento das entregas e o retorno dos veículos.",
    );
  render();
};
$("#optimize").onclick = () => applyStrategy("optimized");
$("#strategy").onchange = (e) => applyStrategy(e.target.value);
$("#new-scenario").onclick = () => {
  newScenario(state.kind, (state.seed + 1) >>> 0);
  toast("Novo cenário gerado com semente " + state.seed + ".");
};
$("#reset").onclick = () => {
  newScenario();
  toast("Mesmo cenário reiniciado. Você pode testar outra estratégia.");
};
$$("[data-scenario]").forEach(
  (b) => (b.onclick = () => newScenario(b.dataset.scenario, state.seed)),
);
$$("[data-speed]").forEach(
  (b) =>
    (b.onclick = () => {
      state.speed = +b.dataset.speed;
      render();
    }),
);
$("#dismiss-tip").onclick = () => $("#map-tip").classList.add("hidden");
$("#order-filter").onchange = () => render();
$("#traffic-event").onclick = () => incident("traffic");
$("#breakdown-event").onclick = () => incident("breakdown");
$("#cancel-event").onclick = () => incident("cancel");
$("#close-modal").onclick = () => $("#modal").close();
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = $("#modal").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("#modal").close();
  }
});
document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  const metric = e.target.closest("[data-metric]")?.dataset.metric;
  if (metric) showMetricHelp(metric);
  if (action === "help") showHelp();
  if (action === "optimize-map") applyStrategy("optimized");
  if (action === "compare") showComparison();
  if (action === "assign") assignManual(state.selectedOrder);
  if (action === "overview")
    $(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  const v = e.target.closest("[data-vehicle]");
  if (v) {
    state.selectedVehicle = +v.dataset.vehicle;
    render();
  }
  const o = e.target.closest("[data-order]");
  if (o) selectOrder(+o.dataset.order);
});
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,select,textarea,button,a") || $("#modal").open)
    return;
  const marker = e.target.closest("[data-order]");
  if (marker && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    selectOrder(+marker.dataset.order);
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    $("#play").click();
  }
  if (e.key.toLowerCase() === "o") $("#optimize").click();
  if (e.key.toLowerCase() === "c") showComparison();
});
$("#zoom-in").onclick = () => {
  state.zoom = Math.min(2.1, state.zoom + 0.2);
  render();
};
$("#zoom-out").onclick = () => {
  state.zoom = Math.max(0.8, state.zoom - 0.2);
  render();
};
$("#zoom-reset").onclick = () => {
  state.zoom = 1;
  state.pan = { x: 0, y: 0 };
  render();
};
let drag = null;
$("#city-map").addEventListener("pointerdown", (e) => {
  if (e.target.closest("[data-order]")) return;
  drag = { x: e.clientX, y: e.clientY, pan: { ...state.pan } };
  $("#city-map").setPointerCapture(e.pointerId);
});
$("#city-map").addEventListener("pointermove", (e) => {
  if (!drag) return;
  const scale = 900 / $("#city-map").getBoundingClientRect().width;
  state.pan = {
    x: drag.pan.x + (e.clientX - drag.x) * scale,
    y: drag.pan.y + (e.clientY - drag.y) * scale,
  };
  $("#map-scene").setAttribute(
    "transform",
    `translate(${450 * (1 - state.zoom) + state.pan.x} ${305 * (1 - state.zoom) + state.pan.y}) scale(${state.zoom})`,
  );
});
$("#city-map").addEventListener("pointerup", () => (drag = null));
$("#city-map").addEventListener("pointercancel", () => (drag = null));
$("#export-button").onclick = () => {
  const payload = {
    version: 1,
    project: "RotaLab",
    generatedAt: new Date().toISOString(),
    kind: state.kind,
    seed: state.seed,
    clock: state.clock,
    traffic: state.traffic,
    strategy: state.strategy,
    orders: state.orders,
    vehicles: state.vehicles.map(
      ({ id, name, capacity, color, pos, route, active, traveled, delay }) => ({
        id,
        name,
        capacity,
        color,
        pos,
        route,
        active,
        traveled,
        delay,
      }),
    ),
    metrics: currentStats(),
    events: state.events,
    assumptions:
      "Cidade sintética; unidade de malha=250m; velocidade=26km/h; prazo no fim do serviço; retorno ao depósito; apoio de 8min após indisponibilidade.",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `rotalab-${state.kind}-seed-${state.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Cenário exportado com premissas e estado da operação.");
};
const initial = scenarioFromSearch(location.search);
drawCity();
newScenario(initial.kind, initial.seed);
requestAnimationFrame(tick);
mountLaboratory({
  getScenario: () => ({ kind: state.kind, seed: state.seed }),
  getOptimizer: () => optimizer,
  notify: toast,
});
$("#share-scenario").onclick = async () => {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("cenario", state.kind);
  url.searchParams.set("semente", state.seed);
  try {
    await navigator.clipboard.writeText(url.href);
    toast(
      "Link copiado. Ele recria o cenário inicial, sem os incidentes da operação.",
    );
  } catch {
    openModal(
      '<h2>Link do cenário inicial</h2><p>Copie o endereço abaixo. O link não inclui os incidentes da operação.</p><input id="scenario-link" readonly aria-label="Link do cenário" style="width:100%;padding:12px">',
    );
    $("#scenario-link").value = url.href;
    $("#scenario-link").select();
  }
};
try {
  optimizer = await createOptimizer();
  $("#optimize").disabled = false;
  render();
} catch (error) {
  console.error(error);
  engineFailed = true;
  render();
  $("#optimize").disabled = true;
  toast(
    "Não foi possível carregar o motor C++. O planejamento de referência e o manual continuam disponíveis.",
  );
}
