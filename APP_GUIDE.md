# Prompt Grammarly — guia da aplicação

Este documento descreve a aplicação desktop, a extensão Chrome, a extensão VS Code, a API local e o modelo Ollama. A interface web do projeto não faz parte deste guia.

## O que a aplicação faz

O Prompt Grammarly revê uma prompt antes de ela ser enviada a um assistente de IA. Funciona como um corretor conservador:

- corrige ortografia, gramática, pontuação e formulações pouco claras;
- preserva a intenção, os factos, a incerteza, o idioma e o nível de detalhe;
- não responde à prompt;
- não acrescenta requisitos, fontes, formatos, exemplos, contexto ou recomendações;
- devolve a frase sem alterações quando ela já está clara;
- apresenta uma checkmark quando o modelo confirma que não são necessárias alterações.

Se o modelo produzir uma resposta, recusa, texto incompleto ou conteúdo semanticamente diferente, essa saída é rejeitada. A aplicação usa então uma correção local conservadora que nunca expande o pedido.

## Componentes

### Aplicação desktop

Está em `apps/desktop-app/` e usa Electron com TypeScript.

1. O utilizador seleciona uma prompt ou coloca o cursor no final do texto.
2. Pressiona `Ctrl+Alt+P`.
3. O helper do Windows copia o texto da aplicação ativa.
4. A prompt é enviada apenas para `127.0.0.1`.
5. O popup mostra a versão corrigida ou a checkmark de confirmação.
6. **Copy** copia o resultado e **Insert** substitui o texto na aplicação original.
7. **Undo** restaura a versão anterior quando disponível.

A aplicação permanece no system tray. O menu permite mudar o modo de desempenho, o atalho, o histórico local, o pré-aquecimento do modelo e abrir diagnósticos.

### Extensão Chrome

Está em `chrome-extension/` e é injetada nos compositores suportados, incluindo ChatGPT, Gemini, Claude, Copilot, Perplexity, DeepSeek, Grok, Mistral, Poe e Meta AI.

- Mostra uma bolha junto ao campo de escrita.
- Abre um popup depois do clique ou, quando ativado, após uma pausa na escrita.
- Mantém a prompt corrigida editável.
- Disponibiliza **Copy**, **Insert Prompt** e **Undo**.
- Deteta campos `textarea`, `input` e `contenteditable` através de adaptadores por site.
- Distingue conversas novas de conversas com mensagens anteriores sem inventar contexto.
- Guarda definições e, opcionalmente, um histórico limitado no armazenamento local do Chrome.
- Trata recarregamentos da extensão sem lançar o erro `Extension context invalidated`.

Quando a prompt já está boa, o popup mostra uma checkmark verde, mantém o texto original e indica que não foram necessárias alterações.

### Extensão VS Code

Está em `extension/`.

- Analisa texto selecionado no editor.
- Usa a mesma lógica partilhada e a mesma API local.
- Permite copiar ou inserir a versão revista.
- Disponibiliza modos Fast, Balanced e Quality nas definições do VS Code.

### API e modelo local

A rota principal está em `app/api/rewrite/route.ts` e escuta em:

```text
http://127.0.0.1:3000/api/rewrite
```

A API comunica com Ollama em `127.0.0.1:11434`. Nenhuma prompt é enviada para serviços cloud.

O system prompt obriga o modelo a atuar apenas como copy editor. A validação em `lib/modelPromptRewriter.ts` confirma que a saída:

- continua a representar o texto original;
- não contém demasiados conceitos novos;
- não é uma resposta, recusa ou comentário sobre a prompt;
- não termina a meio;
- não cresce de forma desproporcional.

Respostas inválidas não são guardadas na cache.

## Modos de desempenho

- **Fast:** `qwen2.5:3b`; contexto e saída reduzidos para menor latência.
- **Balanced:** `qwen2.5:3b`; mais contexto para prompts longas.
- **Quality:** `qwen2.5:3b`; contexto e limite de saída máximos.

Os modelos podem permanecer em memória para reduzir o tempo da primeira revisão. A aplicação pré-aquece automaticamente o modo selecionado.

## Instalação e execução

Pré-requisitos:

- Windows 10 ou 11 para a automação desktop;
- Node.js;
- Ollama instalado.

Na raiz do projeto:

```powershell
npm install
npm run desktop:install
npm run model:pull
npm run desktop
```

O último comando inicia Ollama quando necessário, inicia a API local, aquece o modelo e abre a aplicação no system tray.

## Testar a extensão Chrome

```powershell
npm run dev
npm run build:chrome
```

Depois:

1. Abrir `chrome://extensions`.
2. Ativar **Developer mode**.
3. Escolher **Load unpacked**.
4. Selecionar a pasta `chrome-extension/`.
5. Atualizar os separadores de chat que já estavam abertos.

Sempre que a extensão for recompilada, usar **Reload** em `chrome://extensions` e atualizar também a página onde está a ser testada.

## Testes e qualidade

```powershell
npm test
npm run test:e2e
npm run lint
npm run format:check
npm run build:chrome
npm run build:vscode
npm run desktop:typecheck
```

Os testes E2E verificam campos normais, `contenteditable`, fallback local, inserção, invalidação do contexto Chrome e o estado de checkmark.

## Empacotamento

```powershell
npm run package:chrome
npm run package:vscode
npm run package:desktop
```

Os artefactos são colocados em `release/`. O empacotador desktop escolhe automaticamente uma unidade temporária com espaço suficiente.

## Privacidade e armazenamento

- As prompts são processadas localmente.
- A API aceita apenas clientes locais e origens suportadas.
- O histórico pode ser desativado.
- As definições desktop ficam no perfil local da aplicação.
- As definições Chrome ficam em `chrome.storage.local`.
- Não são usadas chaves de APIs cloud.

Consultar também `PRIVACY.md` e `SECURITY.md`.

## Ficheiros principais

- `chrome-extension/src/content.ts`: deteção, análise e inserção no browser.
- `chrome-extension/src/ui.ts`: popup e checkmark da extensão.
- `chrome-extension/src/siteAdapters.ts`: integração por plataforma de chat.
- `apps/desktop-app/src/main.ts`: atalhos, clipboard, popup e tray.
- `apps/desktop-app/src/windows-helper.ps1`: captura e inserção no Windows.
- `lib/promptAnalyzer.ts`: avaliação local da prompt.
- `lib/promptRewriter.ts`: fallback conservador sem expansão semântica.
- `lib/modelPromptRewriter.ts`: chamada e validação do modelo.
- `app/api/rewrite/route.ts`: API local e comunicação com Ollama.
- `config/product.ts`: modelos, modos e configuração partilhada.

## Resolução de problemas

**O modelo não responde:** confirmar que Ollama está aberto, executar `npm run model:pull` e reiniciar `npm run dev` ou `npm run desktop`.

**A extensão continua com código antigo:** usar **Reload** em `chrome://extensions` e atualizar o separador de chat.

**O atalho não funciona:** fechar instâncias antigas no system tray ou escolher outro atalho nas definições.

**A primeira revisão é lenta:** manter **Keep models in memory** ativo e deixar o pré-aquecimento terminar.

**O modelo acrescenta conteúdo:** a saída deve ser rejeitada pela validação e substituída pelo fallback conservador. Guardar a prompt e a saída num novo teste de regressão se isso voltar a acontecer.
