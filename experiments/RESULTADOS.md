# Experimento sintético — 30 cenários

Executado em 04/11/2026 com o motor nativo compilado a partir de `engine/optimizer.cpp` e o gerador determinístico em `scripts/benchmark.py`. Sementes de 1 a 30; 18 pedidos por cenário; três veículos de 17 volumes; trânsito 1,35×.

| Média dos 30 cenários | Ordem de cadastro | Heurística C++ |
| --- | ---: | ---: |
| Distância, incluindo retorno | 62,6 km | 28,3 km |
| Entregas no prazo | 93,33% | 100,00% |

Valores calculados dos resultados individuais em `benchmark.csv`. Não são ganhos de uma operação real. Os cenários são pequenos e a referência é deliberadamente simples: distribuição em ordem de cadastro por capacidade. Uma avaliação mais ampla deve comparar outras heurísticas e cenários adversos, além de relatar dispersão e custos de computação em condições controladas.

O gerador Python é independente do gerador JavaScript da interface. Sementes iguais nos dois geradores não representam cenários idênticos. A interface calcula seus próprios resultados para a entrada atual.

O campo `process_ms` inclui criação do processo nativo e não deve ser comparado diretamente com o tempo interno do motor WebAssembly mostrado na interface.

