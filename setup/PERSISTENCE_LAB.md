# Izolované persistence experimenty

Příkazy se týkají pouze nových testovacích kontejnerů. CLI spouštíš uvnitř kontejneru, takže lab nemusí publikovat žádný port. Před prvním pokusem použij nová jména kontejnerů a volumes, pokud tyto názvy už existují. Mazání volumes prováděj až po uložení evidence.

## FD-18: řízený RDB pokus

```bash
docker volume create redis-cert-rdb-data
docker run -d --name redis-cert-rdb -v redis-cert-rdb-data:/data redis:8 redis-server --dir /data --save "" --appendonly no
docker exec redis-cert-rdb redis-cli SET mark:A before-snapshot
docker exec redis-cert-rdb redis-cli BGSAVE
docker exec redis-cert-rdb redis-cli INFO persistence
```

Pokračuj teprve po `rdb_bgsave_in_progress:0` a `rdb_last_bgsave_status:ok` vztahujících se k právě dokončenému BGSAVE.

```bash
docker exec redis-cert-rdb redis-cli SET mark:B after-snapshot
docker kill --signal=KILL redis-cert-rdb
docker start redis-cert-rdb
docker exec redis-cert-rdb redis-cli MGET mark:A mark:B
```

Počkej, až restartovaný server odpovídá na PING. Očekávání: A existuje, B chybí. Automatické snapshoty jsou vypnuté a SIGKILL nedává procesu prostor vytvořit nový snapshot při čistém ukončení.

## FD-19: samostatný AOF pokus

```bash
docker volume create redis-cert-aof-data
docker run -d --name redis-cert-aof -v redis-cert-aof-data:/data redis:8 redis-server --dir /data --save "" --appendonly yes --appendfsync everysec
docker exec redis-cert-aof redis-cli SET mark:A aof-value
docker exec redis-cert-aof redis-cli INFO persistence
docker exec redis-cert-aof redis-cli BGREWRITEAOF
```

Pro skutečný úkol piš očíslované markery a ukládej přijatá potvrzení do souboru mimo Redis. Po dokončení rewrite můžeš zabít proces a restartovat jako výše. Porovnej uložené a obnovené hodnoty. Pouhé zabití procesu nezahodí OS page cache, takže není důkazem odolnosti proti výpadku napájení. Nepožaduj jako úspěch testu, aby se určitě ztratila jedna sekunda dat.

Varianty appendfsync nastav v argumentech nově vytvořeného kontejneru nebo CONFIG SET pro daný běh; při restartu se použijí původní argumenty kontejneru. Používej oddělené volumes pro čisté porovnání.

## Úklid po zaznamenání výsledků

```bash
docker rm -f redis-cert-rdb redis-cert-aof
docker volume rm redis-cert-rdb-data redis-cert-aof-data
```

Tyto příkazy odstraní právě data persistence labů; hlavní Compose volumes mají jiná jména.
