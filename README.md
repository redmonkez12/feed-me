# Food Delivery API

Spustitelný NestJS skeleton pro úkoly Food Delivery. Obsahuje PostgreSQL 18,
Drizzle ORM a migrace, Redis `redis-fd`, klienta `redis` (node-redis), Zod validaci
a Adminer. Studijní zadání zůstávají ve složce `02_Food_Delivery/`.

## Rychlý start

Požadavky: Bun 1.4.2+ a Docker s Compose.

```bash
cp .env.example .env
bun install
bun run infra:up
bun run db:migrate
bun run start:dev
```

Ověření aplikace:

```bash
curl http://localhost:3000/api/health
```

Očekávaná odpověď:

```json
{"status":"ok","services":{"postgres":"up","redis":"up"}}
```

## Lokální služby

| Služba | Adresa | Přístup |
|---|---|---|
| API | `http://localhost:3000/api` | health endpoint je `/health` |
| PostgreSQL 18 | `localhost:5432` | DB/user/password: `food_delivery` |
| Redis 8 (`redis-fd`) | `redis://localhost:6380` | bez hesla, pouze localhost |
| Adminer | `http://localhost:8080` | server `postgres`, PostgreSQL credentials výše |

Jediný root Compose spouští PostgreSQL, Redis i Adminer. Služba `redis-fd`
používá přímo konfiguraci `setup/food.conf`: AOF `everysec`, limit 128 MB a
politiku `noeviction`.

## Vývoj

```bash
bun run typecheck
bun run lint
bun run test
bun run build
bun run db:generate   # po změně src/database/schema.ts
bun run db:migrate
bun run db:studio
bun run infra:down
```

První migrace už vytváří základní tabulky `customers`, `restaurants`,
`menu_items`, `drivers`, `orders` a `order_items`. Nest moduly `menus`, `orders`
a `drivers` mají laboratorní `POST /api/<service>/redis-probe` endpointy. Každý
ověří zápis a čtení přes node-redis; klient automaticky přidává prefix `fd:`.

Konfigurace se načítá z `.env` a při startu validuje přes Zod. Připojení jsou
zapouzdřená v globálních `DatabaseModule` a `RedisModule`; obě korektně zavírají
spojení při ukončení procesu. Redis má AOF `everysec` a politiku `noeviction`,
což odpovídá stavové vrstvě rozvozu.

---

# Redis Associate Developer — dva praktické projekty

**64 samostatných úkolů: 32 pro E-Commerce Product Catalog a 32 pro Food Delivery Platform.** Každý projekt má 26 karet hlavního postupu a 6 rozšíření. Celkem tedy 52 hlavních karet a 12 rozšiřujících.

Zadání navazují na dva scénáře z přiloženého screenshotu. Každá karta obsahuje cíl, implementační kroky, kontrolovatelné podmínky splnění, chybový scénář, otázku na porozumění a seznam příkazů. Nápovědy jsou zvlášť, aby neprozradily postup před pokusem.

## Začni zde

1. Přečti [mapu pokrytí](POKRYTI_SYLABU.md): všechna témata viditelného výřezu jsou zahrnuta; úplný aktuální exam guide se nepodařilo nezávisle ověřit.
2. Spusť [lokální setup](setup/README.md) a vyber si jazykový obal. Doporučený klient tohoto balíku je **node-redis v5**; TypeScript/Fastify můžeš použít podle zvyku.
3. Projdi [E-commerce úkoly](01_Ecommerce/README.md), potom [Food Delivery úkoly](02_Food_Delivery/README.md). U každé karty si můžeš vybrat service funkci, CLI lab nebo minimální HTTP endpoint podle zadání.
4. Použij [checklist](CHECKLIST.md) a [šablonu evidence](EVIDENCE_TEMPLATE.md). Při opakování známého tématu stačí skutečně provést acceptance scénáře a vysvětlit výsledek.
5. Závěrečné mise EC-26 a FD-26 proveď bez nápověd. Rozšíření přidej podle kompletního sylabu.

## Obsah ZIPu

| Cesta                                                      | Obsah                                                |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `01_Ecommerce/ukoly/EC-01.md` až `EC-32.md`                | Samostatná zadání katalogu                           |
| `02_Food_Delivery/ukoly/FD-01.md` až `FD-32.md`            | Samostatná zadání rozvozu                            |
| `01_Ecommerce/NAPOVEDY.md`, `02_Food_Delivery/NAPOVEDY.md` | Oddělené nápovědy ke každé kartě                     |
| `POKRYTI_SYLABU.md`                                        | Mapování témat, podklad S/D/R a kontrola mezer       |
| `CHECKLIST.md`                                             | Odškrtávací seznam s odkazy                          |
| `PLAN_STUDIA.md`                                           | Pořadí, milníky a režim při nedostatku času          |
| `data/`                                                    | Produkty, menu, řidiči a objednávky v JSON           |
| `setup/`                                                   | Dva lokální Redis servery a oddělený persistence lab |
| `CHYTAKY.md`                                               | Krátký checklist nejčastějších omylů                 |
| `EVIDENCE_TEMPLATE.md`                                     | Šablona vlastního záznamu výsledků                   |
| `ZDROJE.md`                                                | Oficiální dokumentace a hranice ověření              |

## Čas a výsledek

Součet autorských odhadů hlavních karet je **43.0 hodin** čistého řešení; podle předchozí praxe a ladění se může výrazně lišit. Rozšíření představují dalších **9.7 hodin**. Nejde o předpověď času do získání certifikátu.

Výsledkem mají být dvě malé backendové aplikace a reprodukovatelné důkazy o chování Redis při souběhu, chybách a restartu. ZIP obsahuje **zadání a vstupní podklady**, nikoliv už hotové řešení těchto aplikací.

## Co je a není ověřeno

Balík obsahuje všechna témata viditelná na dodaném screenshotu plus doplňující znalosti a oddělená rozšíření. Nelze z výřezu potvrdit úplnost všech domén certifikátu. Proto je součástí konkrétní kontrola proti celému exam guide. Technické principy byly porovnány s dostupnou oficiální dokumentací; struktura ZIPu, odkazy, ID a fixtures byly zkontrolovány. Přiložený Compose ani budoucí aplikace nebyly v této relaci spuštěny.
