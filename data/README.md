# Vstupní data

Fixtures nejsou automaticky nahrány do Redis: jejich import je součást učení.

- `products.json`: 8 produktů; ceny jsou integer `priceCents` v haléřích. `p999` záměrně chybí.
- `menus.json`: 2 restaurace, 6 jídel a souřadnice.
- `drivers.json`: 5 řidičů včetně vzdáleného, offline a busy.
- `orders.json`: 3 nové objednávky. `dueAtMs = Date.now() + dueInSeconds * 1000` počítej při importu.

Počáteční stav musí být pro každý chybový test reprodukovatelný. Laboratorní klíče drž pod `ec:lab:*` či `fd:lab:*`. Hash fields jsou v základním Redis modelu skalární hodnoty; nested objekty neodesílej přímo jako HSET value.

## Kontrolní výsledky

| Dotaz | Očekávání |
|---|---|
| Electronics ∩ sale | p101, p107 |
| Kategorie audio | p103, p108 |
| Audio a cena >= 100000 | p103 |
| 3 nejlevnější produkty | p104, p108, p105 |
| Vegetarian ∩ available | dish1, dish4, dish6 |
| Vegetarian ∪ spicy | dish1, dish2, dish3, dish4, dish6 |
| Available bez spicy | dish1, dish4, dish5 |
| Geograficky do 2 km od r1 | d1, d2, d4, d5; nikoliv d3 |
| Do 2 km + online + ne busy | d1, d2, pokud je heartbeat čerstvý |

U množin ignoruj pořadí; u GEO porovnávej vzdálenost s tolerancí, nikoliv přesné desetinné reprezentace.
