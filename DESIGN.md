# RotaLab — direção de produto

Aplicação de portfólio de João Vitor Marinho. O visitante planeja uma operação de entregas em uma cidade fictícia, compara estratégias e provoca incidentes durante uma simulação.

## Experiência escolhida

Centro de operações com mapa vetorial, frota colorida, indicadores calculados, entregas selecionáveis, relógio acelerado, linha de eventos e comparação de planos. Na versão 1.2, fundo claro, azul-cobalto, grafite e laranja reservado a séries e atenção. Interface em português e adaptada para celular. A revisão 1.1 usa tipografia de sistema, texto de apoio maior, instruções de tarefa, sequência de atendimento explícita e ajuda por indicador.

## Primeira entrega completa

- Três cenários reproduzíveis por semente.
- Estratégia de referência em ordem de cadastro, planejamento manual e heurística C++.
- C++ compilado para WebAssembly; execução local no navegador.
- Capacidades, prazos, atendimento, retorno ao depósito e tráfego uniforme.
- Simulação animada, pausa, velocidades, reinício, quebra, cancelamento e mudança de tráfego.
- Exportação do estado, documentação e experimentos em Python.

## Modelo e limites

Cidade e pedidos sintéticos. Distâncias Manhattan em uma malha ortogonal; cada unidade equivale a 250 m. Velocidade nominal de 26 km/h. Tempos de serviço explícitos. Atraso medido no fim do atendimento. A heurística usa inserção com penalidade de atraso e busca local; não garante ótimo global. Incidentes podem exigir redistribuição em apoio: oito minutos de espera adicionais para a frota ativa, sem modelagem física da transferência. Comparações usam os mesmos pedidos, capacidades, posições, relógio e tráfego.

## Estrutura

`dist/` contém aplicação estática. `engine/optimizer.cpp` é o motor compartilhado entre WebAssembly e executável nativo. `scripts/benchmark.py` executa experimentos sobre o motor nativo. Não há API remota, dados pessoais ou dependência de serviço de mapas.


## Revisão 1.2

Escolha de implementação: aproveitar o motor existente para um laboratório de sensibilidade, sem introduzir serviços externos. Mapas reais exigiriam dados e outra modelagem; previsão com ML exigiria histórico que o projeto não possui. O experimento preserva a entrada inicial e compara rotas mantidas com replanejamento sob trânsito mais lento. O guia é recolhível para priorizar a operação. A entrega de GitHub contém README curto, imagens reais, arquitetura, limites e automação de testes.
