# Pacchetto di passaggio a Claude Code — Trait Atlas

> **Nota (2026-10-16):** documento storico del passaggio iniziale. Da allora niente PR: Claude committa direttamente su
> `main` (ADR-0007) e tiene il punto di ripresa in `docs/PLAN.md`. I prompt delle Fasi 2 e 3 restano validi, togliendo
> i riferimenti alle PR.

Questo pacchetto contiene tutto quello che serve a Claude Code per sviluppare l'app in tre fasi, senza dover rileggere
la nostra conversazione. La documentazione del repository è in inglese (è la lingua del gioco, dei dati e della
community); questo file è per te.

## Contenuto

```
CLAUDE.md                  → va nella radice del repository: Claude Code lo legge a ogni sessione
docs/SPEC.md               → specifica: dominio, dati, pipeline, funzioni, requisiti non funzionali
docs/GAME_RULES.md         → regole di gioco confermate da te (fusione, mastery, stacking, debuff casuali) e domande aperte
docs/QUERY_LANGUAGE.md     → grammatica della query, campi, diagnostica, autocompletamento
docs/ROADMAP.md            → le tre fasi, milestone grandi quanto una PR, criteri di accettazione
docs/DESIGN.md             → token, tipografia, componenti, accessibilità
docs/adr/                  → 6 decisioni architetturali (la 0002 sul framework va confermata da te)
docs/prototype/            → le 8 schermate del canvas come riferimento di comportamento
```

## Come partire

1. Crea un repository GitHub vuoto (es. `trait-atlas`) e copia dentro tutto il contenuto di questa cartella.
2. Aprilo con Claude Code. `CLAUDE.md` viene letto in automatico.
3. Usa i prompt qui sotto, **una fase alla volta**. Passa alla fase successiva solo quando i criteri di uscita di
   `docs/ROADMAP.md` sono soddisfatti.
4. Quando Claude Code fa una domanda sulle regole di gioco, rispondi e chiedigli di aggiornare `docs/GAME_RULES.md`.

Prima di iniziare: Claude Code deve poter raggiungere `docs.google.com` per scaricare il foglio (sia in locale sia
nelle GitHub Actions). E conviene chiedere il permesso agli autori del compendio prima della pubblicazione.

## Prompt — Fase 1 (Explore + Party planner)

> Leggi CLAUDE.md, docs/ROADMAP.md (Fase 1), docs/SPEC.md, docs/GAME_RULES.md, docs/QUERY_LANGUAGE.md §1–4,
> docs/DESIGN.md e le ADR. Poi:
> 1. Fammi un riepilogo di quello che hai capito e una lista di domande o ambiguità.
> 2. Proponi la scelta del framework (ADR-0002) e aspetta la mia conferma.
> 3. Pianifica le milestone M1–M8 come sequenza di slice piccole, con i test previsti per ciascuna.
> Non scrivere codice finché non approvo il piano. Dopo, procedi una milestone alla volta per sessione, in TDD per `core`,
> e aggiorna le checkbox in ROADMAP.md a ogni merge.

## Prompt — Fase 2 (Smart search + Synergy explorer)

> La Fase 1 è chiusa. Aggiorna "Current phase" a 2 in ROADMAP.md. Rileggi QUERY_LANGUAGE.md §5–8,
> SPEC.md §8.3–8.4 e i prototipi SearchBar, MobileSearch, Synergy, MobileSynergy. Proponi il piano per M9–M13
> come PR piccole, segnalando cosa del codice esistente va esteso (registry di campi, lint, provider di
> autocompletamento) e cosa resta invariato. Aspetta la mia approvazione prima di scrivere codice.

## Prompt — Fase 3 (Party analysis)

> La Fase 2 è chiusa. Aggiorna "Current phase" a 3. Rileggi GAME_RULES.md (tutte le regole, in particolare R2–R5),
> SPEC.md §8.5 e i prototipi PartyLab e MobileParty. Proponi il piano per M14–M17, con i test che coprono i criteri
> di accettazione della Fase 3. Aspetta la mia approvazione prima di scrivere codice.

## Prompt utili in ogni momento

- *Revisione:* «Rivedi la PR corrente rispetto a CLAUDE.md (Definition of done) e ai criteri di accettazione della fase.»
- *Regola nuova:* «Nuova regola di gioco: … Aggiorna GAME_RULES.md, i test e il codice, in una sola PR.»
- *Modifica di design:* «Il design di [schermata] è cambiato così: … Aggiorna DESIGN.md e implementa.»

## Cosa resta aperto

- Conferma del framework (ADR-0002).
- Le 4 domande in fondo a `docs/GAME_RULES.md` (slot dei Mastery/Backer, buff su alleati vs debuff su nemici,
  righe Nether Boss/Avatar, trigger "is afflicted with").
