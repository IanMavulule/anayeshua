# Ana Yeshua - Holy Ghost Ministering

Plataforma de ensino e devocionais da profetisa Ana Yeshua: séries de vídeo com
a primeira aula gratuita, plano Premium pago por M-Pesa, e-Mola, mKesh ou iMali
(iMaliWay), Palavra do dia (mensagem do dia, anotações e pontos de oração),
testemunhos moderados, dúvidas para a profetisa e painel de administração.
Interface em português e inglês.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, i18next (PT/EN), CSS próprio.
- **Backend:** Node + Express 5 em TypeScript (`tsx`), arquitectura MVP, zod.
- **Dados:** PostgreSQL (`pg`): uma tabela por colecção com o registo em JSONB, alterações em transacção.
- **Ficheiros:** capas carregadas em `data/uploads/`.
- **Vídeo:** MP4 locais em `videos/`, servidos por HTTP Range com token de curta duração.

## Arranque

```sh
npm install
cp .env.example .env    # defina DATABASE_URL, ANA_SECRET e ANA_ADMIN_PASSWORD
npm run dev             # API em :8787 + Vite em :5173
```

Antes do primeiro arranque, crie a base de dados no PostgreSQL (por exemplo
`CREATE DATABASE anayeshua;`) e aponte `DATABASE_URL` para ela. No arranque o servidor:

1. cria as tabelas que faltarem;
2. cria a conta de administração (`ANA_ADMIN_EMAIL` / `ANA_ADMIN_PASSWORD`; sem
   palavra-passe definida é gerada uma e mostrada **uma vez** na consola).

Não há dados de exemplo: cursos, eventos e conteúdos criam-se no painel.

Abra <http://localhost:5173>. O painel está em `/admin` (só contas de administração).

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | API + frontend em modo de desenvolvimento |
| `npm test` | Testes do servidor (`node:test`) contra PostgreSQL, num esquema temporário |
| `npm run admin:reset` | Aplica `ANA_ADMIN_PASSWORD` à conta de administração |
| `npm run typecheck` | Verificação de tipos de todo o projecto |
| `npm run build` | Build de produção do frontend (`dist/`) |
| `npm run i18n:check` | Confirma que todos os textos têm tradução PT/EN |
| `npm run i18n:write` | Acrescenta as chaves em falta aos `translations.json` |

## Estrutura

```
server/                 Backend (MVP) — ver server/README.md
  models/               entidades, regras de domínio e armazenamento PostgreSQL
  views/                o que cada resposta expõe
  presenters/           handlers por domínio (admin/ separado por recurso)
  routes/               ligação caminho → middleware → presenter
  services/             tokens, streaming, uploads, migração, pagamentos (iMaliWay)
  schemas/ middleware/ config/
src/                    Frontend (organização do dhis2-semis-core)
  app/ router/          App, routeList e guardas de acesso
  pages/<página>/       landing, login, register, dashboard, devotionals, daily,
                        questions, payment, admin
  components/<domínio>/ layout, devotionals, daily, payment, admin…
  hooks/<domínio>/      auth, catalog, community, payments, common
  schemas/              estado global (sessão)
  types/ utils/         tipos da API, cliente HTTP, constantes, formatação
  locales/{pt,en}/      traduções (chave = texto em inglês)
tests/server/           testes da API
data/uploads/           capas carregadas (não versionado)
videos/                 ficheiros MP4 e legendas .vtt (não versionado)
```

## Vídeos

Cada aula tem um id; o ficheiro correspondente é `videos/<id>.mp4` (e, se
existir, `videos/<id>.vtt` para legendas). O painel envia o ficheiro para o
sítio certo. Para ficheiros copiados à mão, use MP4 H.264 com *faststart*:

```sh
ffmpeg -i entrada.mov -c:v libx264 -preset veryfast -crf 23 -c:a aac -movflags +faststart videos/<id>.mp4
```

## Pagamentos (iMaliWay)

O checkout usa o modo **push C2B** do [iMaliWay](https://imaliway.co.mz/doc2/doc.html):
o cliente recebe no telemóvel o pedido de pagamento e aprova com o PIN; a página
consulta o estado e o plano é activado na confirmação (também via webhook).

- Defina as variáveis `IMALIWAY_*` do `.env.example` (credenciais pedidas a
  info@paytekafrica.com; use as de sandbox para testar). Sem elas o checkout
  fica indisponível e a página de pagamento avisa.
- Os testes usam um fornecedor falso (`tests/server/fakePaymentProvider.ts`). Registe na Paytek o callback
  `https://<domínio>/api/payments/imaliway/webhook`.
- Planos em `server/config/plans.ts`: 200 MT = 30 dias, 500 MT = 90 dias.

## Versionamento

- Commits semânticos em inglês (`feat`, `fix`, `refactor`, `docs`, `chore`) com descrição.
- [Versionamento Semântico](https://semver.org/): cada versão tem uma entrada no
  `CHANGELOG.md` e uma tag `vX.Y.Z`.

## Produção

1. `npm run build` gera `dist/`.
2. Sirva `dist/` e encaminhe `/api`, `/media` e `/uploads` para o servidor Node
   (`node --import tsx server/index.ts` ou `npm run media`), atrás de HTTPS.
3. Defina `NODE_ENV=production` (o cookie de sessão passa a `Secure`) e um `ANA_SECRET` forte.
4. Faça cópia de segurança da base PostgreSQL (`pg_dump`), de `data/uploads/` e de `videos/`.
