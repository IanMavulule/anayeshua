# Servidor — arquitectura MVP

O servidor segue o padrão **Model-View-Presenter**. Cada pedido HTTP passa
pelas camadas sempre na mesma ordem:

```
route ──► middleware ──► presenter ──► models / services
                              │
                              └──► view ──► resposta JSON
```

| Pasta | Responsabilidade | Pode importar |
| --- | --- | --- |
| `models/` | Entidades (`entities.ts`), regras de domínio puras (`userModel.ts`, `courseModel.ts`, `paymentModel.ts`, `postModel.ts`) e acesso a dados (`store/`). Não conhecem HTTP. | `config/`, `utils/` |
| `views/` | Serializers: decidem o que cada resposta expõe (ex.: nunca o `passwordHash`). | `models/` |
| `presenters/` | Um ficheiro por domínio. Validam a entrada com `schemas/`, chamam `models/` e `services/` e respondem através de `views/`. | tudo excepto `routes/` |
| `routes/` | Só ligam caminho → middleware → handler do presenter. `routes/index.ts` monta o `/api`. | `presenters/`, `middleware/` |
| `services/` | Lógica com efeitos ou integrações: tokens, palavras-passe, catálogo, streaming, uploads, migração e pagamentos (`services/payments/`). | `models/`, `views/`, `config/`, `utils/` |
| `schemas/` | Validação dos corpos dos pedidos com zod. | `config/`, `utils/` |
| `middleware/` | Sessão (`attachUser`, `requireAuth`, `requireAdmin`), CSRF, erros e limite de tentativas. | `models/`, `services/` |
| `config/` | Variáveis de ambiente e planos. | — |
| `context.ts` | Dependências partilhadas (db, services) injectadas nos presenters. | — |
| `app.ts` | Composition root: cria tudo e monta as routes. | tudo |

## Convenções

- Ficheiros em camelCase com o sufixo da camada: `authPresenter.ts`,
  `authRoutes.ts`, `authSchemas.ts`, `userView.ts`, `userModel.ts`.
- Presenters são fábricas `createXPresenter(context)` que devolvem os
  handlers; as routes nunca contêm lógica.
- Erros de negócio lançam `HttpError(status, code)`; o `errorHandler`
  responde sempre em JSON com um `code` estável que a UI traduz.
- Os dados vivem em PostgreSQL, em tabelas relacionais com chaves
  estrangeiras. Cada colecção é um repositório em `models/repositories/`
  (sobre `TableRepository`) que implementa a interface `Collection<T>` de
  `models/store/pgStore.ts`, por isso os presenters não sabem como é guardada.
  `db.transaction(tx => …)` agrupa várias escritas numa só transacção.
- O esquema muda só por migrações SQL versionadas em
  `models/store/migrations/NNN_nome.sql`, registadas em `schema_migrations`
  (`models/store/migrator.ts`). Nunca edite uma migração já aplicada: crie a
  seguinte. No arranque, as pendentes só são aplicadas num esquema vazio; com
  dados, faça `pg_dump` e corra `npm run db:migrate` (ou `DATABASE_MIGRATE=auto`).
  As tabelas JSONB antigas ficam como `legacy_*` até serem apagadas à mão.

## Adicionar um endpoint

1. Schema em `schemas/<domínio>Schemas.ts`.
2. Handler em `presenters/<domínio>Presenter.ts` (usar uma view para a resposta).
3. Ligação em `routes/<domínio>Routes.ts`.
4. Teste em `tests/server/`.
