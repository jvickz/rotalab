import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createOptimizer,
  scenario,
  baseline,
  summarize,
  DEPOT,
  km,
} from "../dist/planner.js";
const optimize = await createOptimizer(
  await readFile(new URL("../dist/optimizer.wasm", import.meta.url)),
);
function assertFeasible(result, s) {
  const ids = result.plan.flat();
  assert.equal(new Set(ids).size, ids.length, "pedido duplicado");
  for (let i = 0; i < s.vehicles.length; i++) {
    const v = s.vehicles[i];
    if (!v.active)
      assert.equal(
        result.plan[i].length,
        0,
        "veículo indisponível recebeu carga",
      );
    const load = result.plan[i].reduce(
      (sum, id) => sum + s.orders.find((o) => o.id === id).demand,
      0,
    );
    assert.ok(load <= v.capacity, "capacidade excedida");
  }
  assert.equal(
    ids.length + result.unassigned,
    s.orders.length,
    "contagem de pedidos inconsistente",
  );
  for (const id of ids)
    assert.ok(
      s.orders.some((o) => o.id === id),
      "pedido desconhecido",
    );
}
test("motor WASM mantém viabilidade em 60 cenários reproduzíveis", () => {
  for (const kind of ["centro", "pico", "critico"])
    for (let seed = 1; seed <= 20; seed++) {
      const s = scenario(kind, seed),
        r = optimize(s.orders, s.vehicles, 0, s.traffic);
      assertFeasible(r, s);
    }
});
test("mesma entrada gera o mesmo plano", () => {
  const s = scenario("pico", 42);
  assert.deepEqual(
    optimize(s.orders, s.vehicles).plan,
    optimize(s.orders, s.vehicles).plan,
  );
});
test("veículo indisponível não recebe pedidos e excesso de carga é informado", () => {
  const s = scenario("critico", 42);
  s.vehicles[0].active = false;
  s.vehicles[1].capacity = 1;
  s.vehicles[2].capacity = 1;
  const r = optimize(s.orders, s.vehicles);
  assertFeasible(r, s);
  assert.ok(r.unassigned > 0);
});
test("entrada sem pedidos é aceita", () => {
  const s = scenario();
  const r = optimize([], s.vehicles);
  assert.deepEqual(r.plan, [[], [], []]);
  assert.equal(r.unassigned, 0);
});
test("métrica inclui ida, serviço e retorno", () => {
  const orders = [{ id: 1, x: 14, y: 10, demand: 1, deadline: 4, service: 3 }];
  const vehicles = [{ pos: { ...DEPOT }, capacity: 2, active: true }];
  const s = summarize([[1]], orders, vehicles);
  assert.equal(s.distance, 0.5);
  assert.equal(s.onTime, 100);
  assert.ok(Math.abs(s.arrivals[1] - ((0.25 / 26) * 60 + 3)) < 1e-8);
});
test("retorno de um veículo fora do depósito é incluído sem novos pedidos", () => {
  const v = { pos: { x: 14, y: 10 }, active: true, capacity: 3 };
  assert.equal(summarize([[]], [], [v]).distance, 0.25);
});
test("referência também respeita capacidade", () => {
  const s = scenario("critico", 42),
    plan = baseline(s.orders, s.vehicles);
  assertFeasible({ plan, unassigned: s.orders.length - plan.flat().length }, s);
});
test("plano a partir de posição e horário diferentes mantém métricas finitas", () => {
  const s = scenario("pico", 9);
  s.vehicles[0].pos = { x: 5.5, y: 10 };
  const r = optimize(s.orders, s.vehicles, 60, 1.7);
  const stats = summarize(r.plan, s.orders, s.vehicles, 60, 1.7);
  assertFeasible(r, s);
  assert.ok(Number.isFinite(stats.distance) && stats.finish >= 60);
  assert.ok(km(s.vehicles[0].pos, DEPOT) > 0);
});
