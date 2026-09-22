# Společný setup

Použij Bun 1.4.2+ kompatibilní s vybranou verzí `redis@5`, Docker Compose a svůj editor. TypeScript/Fastify jsou vhodné, ale samotné service funkce s testy stačí. Frontend, platby ani registrace uživatelů nepotřebuješ.

## Spuštění

Z tohoto adresáře:

```bash
docker compose up -d
docker compose exec redis-ec redis-cli PING
docker compose exec redis-fd redis-cli PING
docker compose exec redis-ec redis-cli INFO server
docker compose exec redis-ec redis-cli COMMAND INFO JSON.SET FT.CREATE
```

| Aplikace na hostu | URL | Účel |
|---|---|---|
| E-commerce | redis://127.0.0.1:6379 | Obnovitelná cache, allkeys-lru, bez persistence |
| Food delivery | redis://127.0.0.1:6380 | Stav a fronty, noeviction, AOF everysec |

Uvnitř Compose sítě je port obou služeb 6379 a hostname je jméno služby. Klienti spuštění přímo na hostu používají mapované porty z tabulky.

V každém aplikačním projektu:

```bash
bun init -y
bun add redis@5
```

Vybranou verzi zachovej v `bun.lock`. Vlastní skripty vytvoř v EC-01 / FD-01; balík záměrně neobsahuje hotové business řešení.

## Verze a možnosti serveru

`redis:8` je praktická volba pro lab včetně JSON/Search, nikoliv tvrzení o verzi serveru na certifikační zkoušce. Je to pohyblivý major tag: po stažení zaznamenej konkrétní verzi a pro plnou reprodukovatelnost připni image digest. Pokud již máš Redis 7 se samostatnými moduly, většina základních příkazů funguje také, ale dostupnost JSON/Search ověř přes COMMAND INFO. Verzi uvedenou v přihlášce ke zkoušce vždy porovnej s používanými příkazy.

node-redis v5 není ioredis: liší se API, mapování odpovědí i pipeline. Starší příklady s quit()/disconnect() porovnej s v5 close()/destroy(). Pro WATCH a blokující příkazy používej izolované spojení nebo pool podle aktuálního API. U iteratorů ověř, zda vracejí dávky.

## Praktické hranice tohoto Compose

Konfigurace je určena pro lokální lab: host port je publikovaný pouze na 127.0.0.1, bez autentizace a bez TLS. Neslouží jako produkční nasazení. Jsou zde dva standalone servery, žádný Cluster ani replica. Konfigurační soubory jsou read-only; CONFIG SET je změna běžícího procesu, která se při restartu může ztratit. Trvalé lab nastavení změň v odpovídajícím .conf a server znovu vytvoř.

## Reset a poruchy

- Běžné úkoly resetuj pouze pro konkrétní prefix přes SCAN + UNLINK.
- `docker compose stop redis-ec` a `docker compose start redis-ec` slouží pro výpadek cache.
- `docker compose down` odstraní kontejnery, ale ponechá pojmenované volumes.
- `docker compose down -v` smaže všechna data obou labů; použij jen při vědomém kompletním resetu.
- Crash testy RDB/AOF dělej podle [PERSISTENCE_LAB.md](PERSISTENCE_LAB.md), aby nebyla zasažena hlavní data.

## Jak ověřovat

U každé karty proveď pozitivní a uvedený chybový scénář. Zapisuj skutečný obsah Redis po chybě. U TTL testů toleruj běh času; u concurrency testů kontroluj invarianty. Tento balík byl zkontrolován jako sada zadání a fixtures, nikoliv spuštěn jako hotová aplikace.
