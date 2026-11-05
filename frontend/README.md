# Frontend — SCRUM-21

Base em JavaScript, React 19, Vite 8 e CSS Modules. Requer Node.js 24 LTS com npm.

## Executar

Na raiz do repositório:

```sh
cd frontend
npm ci
npm run dev
```

Abra o endereço informado pelo Vite (normalmente http://localhost:5173).

```sh
npm test
npm run build
npm run preview
```

`build` gera `dist/`. `preview` serve esse build localmente, sem representar um servidor de produção.

## Organização

- `src/App.jsx`: layout, navegação e páginas iniciais; rotas desconhecidas têm uma página própria.
- `src/components/ui.jsx`: Button, FormField, Message e Loading. FormField associa rótulo, ajuda e erro ao campo; Button permite indicar `type="submit"` em formulários.
- `src/services/http.js`: cliente Fetch JSON, configuração da URL, erros HTTP e suporte a AbortSignal. Novos serviços dos módulos devem usar esse cliente.
- `src/*.module.css` e `src/components/ui.module.css`: estilos locais. `global.css` define apenas base e tokens visuais.
- `tests/http.test.js`: verificação do cliente HTTP sem backend nem banco.

## API e configuração

O cliente HTTP está preparado para as próximas integrações. A interface inicial não faz chamadas à API.

No desenvolvimento, o Vite encaminha `/api` para http://localhost:3000. Execute o backend conforme o README da raiz para verificar a conexão real com PostgreSQL. O frontend pode ser navegado sem o backend.

Opcionalmente, copie `.env.example` para `.env` e configure `VITE_API_BASE_URL` com a URL pública da API incluindo `/api`. Reinicie o Vite após alterar variáveis. Tudo que começa com `VITE_` fica público: não inclua senhas nem configuração de banco.

No ambiente publicado e no preview, forneça um encaminhamento de `/api` para o backend ou uma URL pública via `VITE_API_BASE_URL` no build. Se a API estiver em outra origem, a configuração de CORS precisa ser alinhada com seu responsável.

A navegação usa BrowserRouter: a hospedagem deve servir `index.html` ao abrir diretamente `/acesso`, `/ensaios` e `/instrumentos`, preservando as rotas da API.

## Escopo e próximas integrações

As páginas dos módulos são identificadas como em desenvolvimento. Não há login, sessão, proteção de rotas, cadastro, dados simulados nem operações de negócio nesta entrega.

- SCRUM-24: alinhar com Giovani login, identificação da sessão, usuário autenticado, saída, erros e permissões. Não foi escolhido mecanismo de sessão nem criado endpoint de autenticação.
- SCRUM-28: alinhar contratos de ensaios com Vitor.
- SCRUM-32: alinhar instrumentos e estoque com Felipe.

Os contratos desses módulos continuam pendentes. A base não representa a conclusão das histórias da Sprint, que exigem integração e verificação dos critérios de aceite.

## Roteiro no navegador

1. Abra a página inicial e navegue pelos três módulos. Confirme o destaque do menu, o título da aba e o funcionamento de voltar/avançar.
2. Recarregue `/ensaios`. Abra uma rota inexistente e use o link para voltar ao início.
3. Navegue por Tab e use “Pular para o conteúdo”. Confira foco visível e links acionáveis por Enter.
4. Confira a interface em 360 px e em desktop: os cartões devem passar para uma coluna, sem rolagem horizontal.

O roteiro visual e a conexão real precisam ser conferidos no ambiente local da equipe; os testes automatizados do cliente usam respostas controladas.
