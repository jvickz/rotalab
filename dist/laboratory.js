import { baseline, summarize } from "./planner.js";

// A controlled experiment from the initial depot state, not the running operation.
// Two routes stay fixed; only the third strategy receives the changed traffic.
export function runExperiment(input, optimize) {
  if (!Number.isFinite(input.traffic) || input.traffic <= 0) {
    throw new Error("O fator de trânsito deve ser positivo.");
  }
  const { orders, vehicles } = structuredClone(input);
  const reference = baseline(orders, vehicles);
  const fixed = optimize(orders, vehicles, 0, input.traffic).plan;
  const rows = [0, 25, 50, 75, 100].map((increase) => {
    const traffic = input.traffic * (1 + increase / 100);
    const replanned = optimize(orders, vehicles, 0, traffic).plan;
    return {
      increase,
      traffic,
      baseline: summarize(reference, orders, vehicles, 0, traffic),
      fixed: summarize(fixed, orders, vehicles, 0, traffic),
      replanned: summarize(replanned, orders, vehicles, 0, traffic),
    };
  });
  return {
    version: 1,
    kind: input.kind,
    seed: input.seed,
    orders: orders.length,
    rows,
  };
}

export function experimentCSV(result) {
  const lines = [
    "scenario,seed,travel_time_increase_pct,traffic_factor,strategy,distance_km,on_time_pct,late,unassigned,finish_minutes_after_0800",
  ];
  for (const row of result.rows) {
    for (const strategy of ["baseline", "fixed", "replanned"]) {
      const s = row[strategy];
      lines.push(
        [
          result.kind,
          result.seed,
          row.increase,
          row.traffic.toFixed(4),
          strategy,
          s.distance.toFixed(2),
          s.onTime,
          s.late,
          s.unassigned,
          s.finish.toFixed(2),
        ].join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

export function scenarioFromSearch(search) {
  const params = new URLSearchParams(search);
  const kind = ["centro", "pico", "critico"].includes(params.get("cenario"))
    ? params.get("cenario")
    : "pico";
  const raw = params.get("semente");
  const value = Number(raw);
  const seed =
    raw !== null &&
    /^\d+$/.test(raw) &&
    Number.isSafeInteger(value) &&
    value <= 0xffffffff
      ? value
      : 42;
  return { kind, seed };
}
