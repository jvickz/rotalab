# Publicação no GitHub

O pacote preparado contém código, WASM, testes, imagens e documentação. Não inclui o histórico de hospedagem nem a pasta `.openai` do ambiente privado.

## Repositório sugerido

- Nome: `rotalab`
- Descrição: `Simulador logístico com C++/WebAssembly, comparação de rotas e análise de sensibilidade ao trânsito.`
- Tópicos: `logistics`, `route-optimization`, `cpp`, `webassembly`, `javascript`, `python`, `simulation`, `operations-research`.
- A seção About deve receber a URL da demonstração somente após a publicação ser confirmada.

Crie o repositório vazio, sem gerar outro README. Na pasta preparada:

```sh
git init -b main
git add .
git commit -m "feat: publish RotaLab logistics simulator"
git remote add origin https://github.com/jvickz/rotalab.git
git push -u origin main
```

Esses comandos são instruções para a etapa de publicação; não indicam que o repositório já foi criado. A pasta preparada não tem credenciais nem um remote configurado. A licença de distribuição ainda deve ser escolhida pelo autor antes de disponibilizar o projeto como código aberto.

## Demonstração pública

1. No GitHub, abra **Settings → Pages → Source → GitHub Actions**.
2. Em **Actions**, execute **Publish demo to GitHub Pages** na branch `main`.
3. Aguarde os testes e o deploy. Use a URL retornada pelo job; verifique também os caminhos de `optimizer.wasm` e das imagens.
4. Adicione a URL confirmada ao README e ao About. Fixe o repositório no perfil.

A publicação é manual para evitar expor a demo apenas ao preparar os arquivos. O workflow de validação roda em pushes e pull requests. Os workflows foram preparados; sua execução no GitHub depende da criação do repositório e da configuração do Pages.

Referência: [documentação oficial de GitHub Pages com Actions](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically).
