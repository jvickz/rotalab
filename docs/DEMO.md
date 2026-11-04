# Demonstração em dois minutos

1. Abra **Hora do pico**, semente 42. A ordem de cadastro projeta 75,5 km e 94% de pontualidade.
2. Clique em **Comparar estratégias**. O plano automático desta entrada projeta 32 km e 100%. Explique que reduzir distância é apenas parte da função objetivo.
3. Use as rotas automáticas e inicie a operação. Selecione um veículo para mostrar a sequência e pause antes de provocar trânsito.
4. Abra **Laboratório de cenários** e execute o experimento. Em +50%, a rota automática mantida tem uma entrega atrasada; a recalculada tem zero. As condições são sintéticas e partem do estado inicial.
5. Mostre o CSV e o teste que verifica que mais trânsito não melhora a pontualidade de uma rota fixa.

## Explicação curta

“O RotaLab compara decisões de roteamento sob capacidade e prazo. Usei C++ compilado para WebAssembly no navegador, JavaScript na simulação e Python nos experimentos em lote. O laboratório mantém os pedidos constantes e varia o trânsito para separar o efeito da mudança do efeito do replanejamento.”

## Questões para uma entrevista

- Por que uma rota mais curta pode ter mais atrasos?
- Como a função objetivo influencia a distribuição da frota?
- Como provar que a comparação é reproduzível?
- Quais hipóteses precisariam mudar para uma operação real?
- Por que otimização combinatória não equivale a machine learning?

Os números acima pertencem apenas ao cenário indicado, na versão 1.2. A documentação e a demonstração não devem apresentar esses resultados como economia real de uma empresa.
