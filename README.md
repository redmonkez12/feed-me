# Food Delivery API

A runnable NestJS skeleton for the Food Delivery exercises. It includes PostgreSQL 18,
Drizzle ORM with migrations, the `redis-fd` Redis instance, the `redis` client
(node-redis), Zod validation, and Adminer. The study exercises remain in the
`02_Food_Delivery/` directory.

## Quick Start

Requirements: Bun 1.4.2+ and Docker with Compose.

```bash
cp .env.example .env
bun install
bun run infra:up
bun run db:migrate
bun run db:seed
bun run start:dev
```

Verify the application:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"status":"ok","services":{"postgres":"up","redis":"up"}}
```

## Local Services

| Service | Address | Access |
|---|---|---|
| API | `http://localhost:3000/api` | The health endpoint is `/health` |
| PostgreSQL 18 | `localhost:5432` | Database/user/password: `food_delivery` |
| Redis 8 (`redis-fd`) | `redis://localhost:6380` | No password, localhost only |
| Adminer | `http://localhost:8080` | Server: `postgres`; use the PostgreSQL credentials above |

A single root-level Compose configuration starts PostgreSQL, Redis, and Adminer.
The `redis-fd` service uses `setup/food.conf` directly, with AOF set to
`everysec`, a 128 MB limit, and the `noeviction` policy.

## Development

```bash
bun run typecheck
bun run lint
bun run test
bun run build
bun run db:generate   # after changing src/database/schema.ts
bun run db:migrate
bun run db:seed       # load data/*.json into PostgreSQL
bun run db:studio
bun run infra:down
```

### Database Seed

`bun run db:seed` loads the food-delivery fixtures from `data/menus.json`,
`data/drivers.json`, and `data/orders.json`. Fixture identifiers such as `r1`,
`d1`, and `o1001` are converted to stable UUIDs because the PostgreSQL schema
uses UUID primary keys. The command is idempotent and updates its existing rows
instead of creating duplicates.

The order fixtures do not include customer profiles or delivery addresses, so
the seed creates clearly marked test values for those required columns. Order
totals and item prices are derived from the menu fixtures. Coordinates, online
membership, and delivery deadlines are intentionally left for the Redis model;
the relational schema has no corresponding columns.

The initial migration creates the core `customers`, `restaurants`, `menu_items`,
`drivers`, `orders`, and `order_items` tables. The `menus`, `orders`, and
`drivers` Nest modules provide experimental `POST /api/<service>/redis-probe`
endpoints. Each endpoint verifies writing and reading through node-redis; the
client automatically adds the `fd:` prefix.

Configuration is loaded from `.env` and validated with Zod at startup.
Connections are encapsulated in the global `DatabaseModule` and `RedisModule`;
both close their connections cleanly when the process shuts down. Redis uses
AOF `everysec` and the `noeviction` policy, which are appropriate for the
delivery state layer.

---

# Redis Associate Developer — Two Practical Projects

**64 self-contained exercises: 32 for the E-Commerce Product Catalog and 32 for
the Food Delivery Platform.** Each project contains 26 core learning cards and
6 extensions, for a total of 52 core cards and 12 extension cards.

The exercises build on the two scenarios shown in the provided screenshot.
Each card includes an objective, implementation steps, verifiable acceptance
criteria, a failure scenario, a comprehension question, and a list of commands.
Hints are kept separate so they do not reveal the solution before you attempt
the exercise.

## Start Here

1. Read the [coverage map](POKRYTI_SYLABU.md). It covers every topic visible in
   the supplied excerpt, but the complete current exam guide could not be
   independently verified.
2. Start the [local environment](setup/README.md) and choose a language wrapper.
   The recommended client for this package is **node-redis v5**; use
   TypeScript/Fastify if that is your preferred stack.
3. Work through the [E-Commerce exercises](01_Ecommerce/README.md), followed by
   the [Food Delivery exercises](02_Food_Delivery/README.md). For each card, you
   can implement a service function, a CLI lab, or a minimal HTTP endpoint, as
   specified by the exercise.
4. Use the [checklist](CHECKLIST.md) and the
   [evidence template](EVIDENCE_TEMPLATE.md). When revisiting a familiar topic,
   it is enough to run the acceptance scenarios and explain the result.
5. Complete the final EC-26 and FD-26 missions without hints. Add the extensions
   based on the complete syllabus.

## ZIP Contents

| Path                                                       | Contents                                             |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `01_Ecommerce/ukoly/EC-01.md` through `EC-32.md`           | Self-contained catalog exercises                     |
| `02_Food_Delivery/ukoly/FD-01.md` through `FD-32.md`       | Self-contained delivery exercises                    |
| `01_Ecommerce/NAPOVEDY.md`, `02_Food_Delivery/NAPOVEDY.md` | Separate hints for each card                         |
| `POKRYTI_SYLABU.md`                                        | Topic mapping, S/D/R references, and gap analysis    |
| `CHECKLIST.md`                                             | Linked checklist                                     |
| `PLAN_STUDIA.md`                                           | Sequence, milestones, and time-constrained study plan |
| `data/`                                                    | Products, menus, drivers, and orders in JSON         |
| `setup/`                                                   | Two local Redis servers and a separate persistence lab |
| `CHYTAKY.md`                                               | Short checklist of common pitfalls                   |
| `EVIDENCE_TEMPLATE.md`                                     | Template for recording your results                  |
| `ZDROJE.md`                                                | Official documentation and verification scope        |

## Time and Outcome

The author's estimates for the core cards total **43.0 hours** of focused work;
the actual time may vary considerably depending on prior experience and
debugging. The extensions add another **9.7 hours**. These figures are not a
prediction of how long it will take to earn the certification.

The intended outcome is two small backend applications and reproducible
evidence of Redis behavior under concurrency, failures, and restarts. The ZIP
contains **exercise specifications and starter materials**, not completed
implementations of these applications.

## Verification Scope

The package covers every topic visible in the supplied screenshot, along with
supporting knowledge and separate extensions. The excerpt alone cannot confirm
complete coverage of every certification domain, so the package includes a
specific review against the full exam guide. The technical principles were
compared with the available official documentation, and the ZIP structure,
links, IDs, and fixtures were checked. The included Compose environment and the
applications to be built were not run during that review session.
