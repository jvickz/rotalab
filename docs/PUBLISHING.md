# Manutenção da publicação

O repositório público contém código, testes, documentação e os arquivos estáticos em `dist/`. A demonstração é publicada pelo workflow **Publish demo to GitHub Pages**.

## Atualizar o projeto

1. Faça as alterações e execute `node --test` e `npm run check`.
2. Envie um commit ou pull request para `main`. O workflow **Validate RotaLab** verifica sintaxe e testes.
3. Para atualizar a demonstração, abra **Actions → Publish demo to GitHub Pages → Run workflow**, usando `main`.
4. Aguarde a conclusão do deploy e teste o motor WASM, a comparação e o laboratório pela URL pública.

A publicação da demonstração é manual. Um push atualiza o código e dispara os testes, mas não altera sozinho o site. A origem de Pages está configurada como **GitHub Actions**, com os arquivos de `dist/`.

A aplicação não exige chaves de API, banco de dados ou credenciais para funcionar. Não publique a pasta `.openai`, arquivos `.env`, executáveis nativos ou histórico do ambiente de hospedagem privada. O script `scripts/prepare_github.py` gera uma cópia limpa para distribuir o código.

O repositório é público para consulta do portfólio. Não há licença de redistribuição definida; uma licença pode ser adicionada pelo autor se desejar permitir reutilização do código.

Referência: [GitHub Pages com Actions](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically).
