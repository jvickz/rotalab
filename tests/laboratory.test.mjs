import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createOptimizer, scenario } from "../dist/planner.js";
import {
  runExperiment,
  experimentCSV,
  scenarioFromSearch,
} from "../dist/laboratory.js";

const optimize = await createOptimizer(
  await readFile(new URL("../dist/optimizer.wasm", import.meta.url)),
);

test("experimento mantém cenário original e compara os mesmos pedidos em cinco níveis", () => {
  const input = scenario("pico", 42);
  const original = structuredClone(input);
  const result = runExperiment(input, optimize);
  assert.deepEqual(input, original);
  assert.equal(result.rows.length, 5);
  assert.equal(result.rows[0].traffic, input.traffic);
  assert.equal(result.rows.at(-1).traffic, input.traffic * 2);
  assert.deepEqual(result.rows[0].fixed, result.rows[0].replanned);
  for (const row of result.rows) {
    for (const key of ["baseline", "fixed", "replanned"]) {
      assert.equal(
        row[key].assigned + row[key].unassigned,
        input.orders.length,
      );
      assert.ok(Number.isFinite(row[key].distance));
    }
    assert.equal(row.fixed.distance, result.rows[0].fixed.distance);
  }
  assert.deepEqual(runExperiment(input, optimize), result);
});

test("mesma rota com mais trânsito não melhora prazo e exporta todos os resultados", () => {
  const result = runExperiment(scenario("critico", 19), optimize);
  for (let i = 1; i < result.rows.length; i++) {
    assert.ok(result.rows[i].fixed.onTime <= result.rows[i - 1].fixed.onTime);
  }
  const csv = experimentCSV(result);
  assert.equal(csv.trim().split("\n").length, 16);
  assert.match(csv, /critico,19/);
  assert.match(csv, /replanned/);
});

test("cenário vazio é calculável e entradas fora do domínio são rejeitadas", () => {
  const input = scenario();
  input.orders = [];
  assert.equal(runExperiment(input, optimize).rows[0].fixed.onTime, 100);
  input.traffic = 0;
  assert.throws(() => runExperiment(input, optimize), /trânsito/i);
});

test("links reproduzem semente e cenário; valores inválidos voltam ao padrão", () => {
  assert.deepEqual(scenarioFromSearch("?cenario=critico&semente=0"), {
    kind: "critico",
    seed: 0,
  });
  assert.deepEqual(scenarioFromSearch("?cenario=pico&semente=4294967295"), {
    kind: "pico",
    seed: 4294967295,
  });
  for (const value of ["-1", "1.5", "Infinity", "abc", "", "4294967296"]) {
    assert.deepEqual(scenarioFromSearch("?cenario=invalid&semente=" + value), {
      kind: "pico",
      seed: 42,
    });
  }
});
