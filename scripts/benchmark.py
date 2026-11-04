"""Compare cadastro vs C++ on deterministic generated scenarios. Python stdlib only."""
import argparse
import csv
import json
import random
import subprocess
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
DEPOT = (13, 10)

def distance(a, b):
    return (abs(a[0] - b[0]) + abs(a[1] - b[1])) * .25

def evaluate(routes, orders, vehicles, traffic):
    total = 0.0
    ontime = 0
    for route, v in zip(routes, vehicles):
        pos = v[:2]
        clock = 0.0
        for i in route:
            o = orders[i]
            d = distance(pos, o[:2])
            total += d
            clock += d / 26 * 60 * traffic + o[4]
            ontime += clock <= o[3]
            pos = o[:2]
        if route:
            total += distance(pos, DEPOT)
    return total, ontime / len(orders) * 100

def run(seed, engine):
    rng = random.Random(seed)
    orders = [[rng.randint(2, 24), rng.randint(2, 17), rng.randint(1, 3), rng.randint(45, 189), rng.randint(3, 5)] for _ in range(18)]
    vehicles = [[13, 10, 17, 1] for _ in range(3)]
    payload = [18, 3, 0, 1.35] + [x for o in orders for x in o] + [x for v in vehicles for x in v]
    start = perf_counter()
    result = subprocess.run([str(engine)], input=' '.join(map(str, payload)), text=True, capture_output=True, check=True)
    elapsed = (perf_counter() - start) * 1000
    lines = result.stdout.strip().splitlines()
    unassigned = int(lines[0])
    routes = [list(map(int, line.split()))[1:] for line in lines[1:]]
    flat = [i for r in routes for i in r]
    assert len(flat) == len(set(flat))
    assert len(flat) + unassigned == len(orders)
    for r, v in zip(routes, vehicles):
        assert sum(orders[i][2] for i in r) <= v[2]
    reference = [[], [], []]
    loads = [0, 0, 0]
    cursor = 0
    for i, o in enumerate(orders):
        for offset in range(3):
            v = (cursor + offset) % 3
            if loads[v] + o[2] <= vehicles[v][2]:
                reference[v].append(i)
                loads[v] += o[2]
                cursor = (v + 1) % 3
                break
    a = evaluate(reference, orders, vehicles, 1.35)
    b = evaluate(routes, orders, vehicles, 1.35)
    return dict(seed=seed,reference_km=round(a[0],3),cpp_km=round(b[0],3),reference_ontime_pct=round(a[1],2),cpp_ontime_pct=round(b[1],2),unassigned=unassigned,process_ms=round(elapsed,3))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--engine', type=Path, required=True)
    parser.add_argument('--scenarios', type=int, default=30)
    parser.add_argument('--output', type=Path, default=ROOT/'experiments'/'benchmark.csv')
    args = parser.parse_args()
    if args.scenarios < 1:
        parser.error('--scenarios deve ser positivo')
    rows = [run(seed, args.engine.resolve()) for seed in range(1,args.scenarios+1)]
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
    print(json.dumps({'scenarios':len(rows),'mean_reference_km':sum(r['reference_km'] for r in rows)/len(rows),'mean_cpp_km':sum(r['cpp_km'] for r in rows)/len(rows),'mean_reference_ontime_pct':sum(r['reference_ontime_pct'] for r in rows)/len(rows),'mean_cpp_ontime_pct':sum(r['cpp_ontime_pct'] for r in rows)/len(rows),'note':'process_ms inclui inicialização do processo; gerador Python difere do gerador JavaScript; resultados apenas sintéticos'},ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
