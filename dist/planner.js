export const DEPOT = { x: 13, y: 10 };
export const COLORS = ["#397bf6", "#ed883b", "#8162da", "#14a18c"];
export const km = (a, b) => (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 0.25;
export const travel = (a, b, traffic = 1) => (km(a, b) / 26) * 60 * traffic;
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function scenario(kind = "centro", seed = 42) {
  const r = seeded(seed),
    size = { centro: 12, pico: 18, critico: 24 }[kind] || 18;
  const orders = [];
  const used = new Set(["13,10"]);
  for (let i = 0; i < size; i++) {
    let x, y;
    do {
      x = 2 + Math.floor(r() * 23);
      y = 2 + Math.floor(r() * 16);
    } while (used.has(`${x},${y}`));
    used.add(`${x},${y}`);
    orders.push({
      id: i + 1,
      x,
      y,
      demand: 1 + Math.floor(r() * 3),
      deadline:
        (kind === "centro" ? 45 : kind === "pico" ? 35 : 30) +
        Math.floor(
          r() * (kind === "centro" ? 145 : kind === "pico" ? 110 : 100),
        ),
      service: 3 + Math.floor(r() * 3),
      status: "pending",
      assigned: null,
      name:
        ["Mercado", "Ateliê", "Farmácia", "Café", "Livraria", "Empório"][
          i % 6
        ] +
        " " +
        ["das Flores", "Central", "do Porto", "da Praça"][
          Math.floor(i / 6) % 4
        ],
    });
  }
  const vehicles = Array.from({ length: 3 }, (_, i) => ({
    id: i + 1,
    name: ["Aurora", "Horizonte", "Brisa"][i],
    color: COLORS[i],
    capacity: Math.ceil((size * 2) / 3) + 5,
    pos: { ...DEPOT },
    route: [],
    active: true,
    traveled: 0,
    delay: 0,
  }));
  return {
    orders,
    vehicles,
    kind,
    seed,
    traffic: kind === "pico" ? 1.35 : kind === "critico" ? 1.6 : 1,
  };
}
export function baseline(orders, vehicles) {
  const plan = vehicles.map(() => []),
    loads = vehicles.map(() => 0);
  let cursor = 0;
  for (const o of orders) {
    for (let k = 0; k < vehicles.length; k++) {
      let v = (cursor + k) % vehicles.length;
      if (vehicles[v].active && loads[v] + o.demand <= vehicles[v].capacity) {
        plan[v].push(o.id);
        loads[v] += o.demand;
        cursor = (v + 1) % vehicles.length;
        break;
      }
    }
  }
  return plan;
}
export function summarize(plan, orders, vehicles, clock = 0, traffic = 1) {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const arrivals = {};
  let distance = 0,
    late = 0,
    assigned = 0,
    maxFinish = clock;
  const perVehicle = vehicles.map((v, i) => {
    let pos = v.pos,
      t = clock + (v.delay || 0),
      d = 0,
      load = 0;
    for (const id of plan[i] || []) {
      const o = byId.get(id);
      if (!o) continue;
      const leg = km(pos, o);
      d += leg;
      t += travel(pos, o, traffic) + o.service;
      arrivals[id] = t;
      late += t > o.deadline ? 1 : 0;
      assigned++;
      load += o.demand;
      pos = o;
    }
    if (v.active && ((plan[i] || []).length || km(pos, DEPOT) > 0.0001)) {
      d += km(pos, DEPOT);
      t += travel(pos, DEPOT, traffic);
    }
    maxFinish = Math.max(t, maxFinish);
    distance += d;
    return { distance: d, finish: t, load, count: (plan[i] || []).length };
  });
  return {
    distance,
    late,
    assigned,
    unassigned: orders.length - assigned,
    onTime: orders.length
      ? Math.round(((assigned - late) / orders.length) * 100)
      : 100,
    finish: maxFinish,
    arrivals,
    perVehicle,
  };
}
export function packInput(orders, vehicles, clock = 0, traffic = 1) {
  return Float64Array.from([
    orders.length,
    vehicles.length,
    clock,
    traffic,
    ...orders.flatMap((o) => [o.x, o.y, o.demand, o.deadline, o.service]),
    ...vehicles.flatMap((v) => [
      v.pos.x,
      v.pos.y,
      v.capacity,
      v.active ? 1 : 0,
    ]),
  ]);
}
export async function createOptimizer(bytes) {
  const source =
    bytes || (await (await fetch("./optimizer.wasm")).arrayBuffer());
  const { instance } = await WebAssembly.instantiate(source, {});
  const ex = instance.exports;
  return (orders, vehicles, clock = 0, traffic = 1) => {
    if (orders.length > 40 || vehicles.length > 5)
      throw Error("Limite do motor: 40 entregas e 5 veículos.");
    new Float64Array(ex.memory.buffer, ex.get_input_ptr(), 1024).set(
      packInput(orders, vehicles, clock, traffic),
    );
    const start = performance.now();
    const unassigned = ex.optimize();
    if (unassigned < 0) throw Error("Entrada inválida no motor.");
    const output = new Int32Array(
      ex.memory.buffer,
      ex.get_output_ptr(),
      vehicles.length * 41,
    );
    const plan = vehicles.map((_, v) =>
      Array.from(output.slice(v * 41 + 1, v * 41 + 1 + output[v * 41])).map(
        (index) => orders[index].id,
      ),
    );
    return { plan, unassigned, milliseconds: performance.now() - start };
  };
}
