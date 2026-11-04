import { scenario } from "./planner.js";
import { runExperiment, experimentCSV } from "./laboratory.js";

const number = (value, digits = 1) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const series = [
  {
    key: "baseline",
    label: "Ordem de cadastro",
    color: "#667085",
    dash: "4 5",
  },
  { key: "fixed", label: "Automática mantida", color: "#ba5b16", dash: "10 5" },
  {
    key: "replanned",
    label: "Automática recalculada",
    color: "#2455d6",
    dash: "",
  },
];

export function mountLaboratory({ getScenario, getOptimizer, notify }) {
  const root = document.querySelector("#laboratory");
  const runButton = document.querySelector("#run-experiment");
  const output = document.querySelector("#experiment-output");
  let result = null;
  let selected = 2;

  function renderDetail() {
    const row = result.rows[selected];
    root.querySelectorAll("[data-experiment-point]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        Number(button.dataset.experimentPoint) === selected,
      );
    });
    const improvement = row.replanned.onTime - row.fixed.onTime;
    const delta = row.replanned.distance - row.fixed.distance;
    const sentence =
      improvement > 0
        ? `Recalcular recuperou ${improvement} pontos percentuais de pontualidade.`
        : improvement < 0
          ? `Recalcular perdeu ${-improvement} pontos percentuais de pontualidade. A heurística não melhora todas as métricas.`
          : "Recalcular não mudou a pontualidade neste nível de trânsito.";
    root.querySelector("#experiment-detail").innerHTML = `
      <div class="experiment-verdict"><span class="eyebrow">TEMPO DE DESLOCAMENTO +${row.increase}%</span><h3>${sentence}</h3><p>${delta === 0 ? "A distância total permaneceu igual." : `O percurso recalculado ficou ${number(Math.abs(delta))} km ${delta > 0 ? "mais longo" : "mais curto"}.`} Mesmo conjunto de ${result.orders} pedidos, capacidades e prazos.</p></div>
      <div class="table-wrap"><table><caption>Resultado com fator de trânsito ${number(row.traffic, 2)}×</caption><thead><tr><th>Estratégia</th><th>No prazo</th><th>Atrasadas</th><th>Sem veículo</th><th>Distância</th></tr></thead><tbody>${series.map((s) => `<tr><th scope="row"><span class="series-dot" style="--series-color:${s.color}"></span>${s.label}</th><td>${row[s.key].onTime}%</td><td>${row[s.key].late}</td><td>${row[s.key].unassigned}</td><td>${number(row[s.key].distance)} km</td></tr>`).join("")}</tbody></table></div>`;
  }

  function render() {
    const x = (index) => 56 + index * 153;
    const y = (value) => 218 - value * 1.7;
    output.innerHTML = `
      <div class="experiment-context"><strong>${{ centro: "Centro", pico: "Hora do pico", critico: "Dia crítico" }[result.kind]} · semente ${result.seed}</strong><span>Saída às 08:00 · cenário inicial · sem incidentes</span></div>
      <div class="experiment-grid"><div class="experiment-chart"><p class="chart-title">Entregas no prazo <span>% dos pedidos</span></p><svg viewBox="0 0 720 265" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">Sensibilidade das rotas ao trânsito</title><desc id="chart-desc">Compare a pontualidade de três estratégias em cinco níveis de trânsito. Os valores de cada nível estão na tabela abaixo.</desc>${[0, 25, 50, 75, 100].map((v) => `<line x1="56" y1="${y(v)}" x2="668" y2="${y(v)}" stroke="#e1e5ec"/><text x="40" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}${series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="3" stroke-dasharray="${s.dash}" points="${result.rows.map((row, i) => `${x(i)},${y(row[s.key].onTime)}`).join(" ")}"/>${result.rows.map((row, i) => `<circle cx="${x(i)}" cy="${y(row[s.key].onTime)}" r="4" fill="white" stroke="${s.color}" stroke-width="2"/>`).join("")}`).join("")}${result.rows.map((row, i) => `<text x="${x(i)}" y="250" text-anchor="middle">+${row.increase}%</text>`).join("")}</svg><p class="chart-axis">Aumento do tempo de deslocamento em relação ao cenário</p><div class="chart-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div></div>
      <aside class="experiment-method"><span class="eyebrow">COMO LER O EXPERIMENTO</span><h3>O que estamos comparando</h3><p><strong>Cadastro:</strong> preserva a sequência original.</p><p><strong>Automática mantida:</strong> usa a rota calculada antes de o trânsito mudar.</p><p><strong>Automática recalculada:</strong> refaz o plano para cada condição.</p><p>A queda na curva mostra os limites do plano. Não é uma previsão de trânsito real.</p></aside></div>
      <div class="experiment-selector"><span>Inspecionar condição</span><div role="group" aria-label="Aumento do tempo de deslocamento">${result.rows.map((row, i) => `<button data-experiment-point="${i}" aria-pressed="${i === selected}">+${row.increase}%</button>`).join("")}</div></div><div id="experiment-detail" aria-live="polite"></div>
      <div class="experiment-footer"><p>Experimento independente: não altera a operação no mapa. Empates e pioras também são exibidos.</p><button class="ghost" id="export-experiment">Baixar resultados CSV</button></div>`;
    output.hidden = false;
    output.querySelectorAll("[data-experiment-point]").forEach(
      (button) =>
        (button.onclick = () => {
          selected = Number(button.dataset.experimentPoint);
          renderDetail();
        }),
    );
    output.querySelector("#export-experiment").onclick = () => {
      const url = URL.createObjectURL(
        new Blob(["\ufeff" + experimentCSV(result)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `rotalab-experimento-${result.kind}-${result.seed}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    renderDetail();
  }

  runButton.onclick = async () => {
    const optimize = getOptimizer();
    if (!optimize) {
      notify(
        "O motor C++ precisa estar disponível para executar o experimento.",
      );
      return;
    }
    const { kind, seed } = getScenario();
    runButton.disabled = true;
    runButton.textContent = "Calculando cinco condições…";
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    try {
      result = runExperiment(scenario(kind, seed), optimize);
      render();
      notify(
        "Experimento calculado. Selecione uma condição para inspecionar os resultados.",
      );
    } catch (error) {
      console.error(error);
      notify("Não foi possível calcular o experimento. Tente novamente.");
    } finally {
      runButton.disabled = false;
      runButton.textContent = "Executar experimento";
    }
  };
}
