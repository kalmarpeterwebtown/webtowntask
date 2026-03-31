# Webtown Project Rules

Ez a fájl a közös fejlesztési szabályokat rögzíti, hogy új sessionben is ugyanazzal a munkamóddal lehessen folytatni.

## 1. Általános elvek

- A cél a stabil működés, nem csak az, hogy “valahogy menjen”.
- Minden változtatásnál a regressziók minimalizálása az elsődleges.
- Kisebb, jól körülhatárolt módosítások előnyben.
- Ha egy rész érzékeny vagy már többször javítottuk, ott ne legyen felesleges refaktor.

## 2. Ellenőrzés minden lényegi módosítás után

Minimum:

```bash
npm run test
npm run lint
npm run build
```

Ha egy funkció UI-ban érzékeny:
- kézi ellenőrzés is kell local dev szerveren

## 3. Deploy szabály

- Frontend változás esetén:
  - `git push origin main`
- Firestore rules változás esetén:
  - külön `firebase deploy --only firestore:rules --project webtown-agile-task-management`
- Storage rules változás esetén:
  - külön `firebase deploy --only storage --project webtown-agile-task-management`

## 4. UI / UX szabályok

- A használat legyen gyors és intuitív.
- Az inline szerkesztés előnyben részesítendő, ahol értelmes.
- A túl hosszú listákat lehetőleg kompaktabb kártyás vagy kétoszlopos nézetben jelenítsük meg.
- A board a napi munkaterület, ne legyen túlzsúfolva.
- A sprint / burndown másodlagos panelben vagy összecsukható blokkokban jelenjen meg.

## 5. Terminológia

- `SP` a helyes rövidítés, ne használjunk `pt`-t.
- `Ügyfél` a helyes megnevezés, ne `Kliens`.
- `Delivered` maradhat technikai státuszként és UI elemként, ha illeszkedik a flow-hoz.

## 6. Jogosultsági szabályok

- `read`: ne tudjon írni
- `write`: tudjon operatív munkát végezni
- `manage`: tudjon konfigurálni és tagságot kezelni
- Ügyfél:
  - worklogot nem láthat
  - worklogot nem írhat

Ha jogosultságot módosítasz:
- ne csak a UI-t nézd
- ellenőrizd a `firestore.rules` oldalt is

## 7. Érzékeny részek

Különösen kockázatos fájlok:

- `/src/pages/BoardPage.tsx`
- `/src/pages/BacklogPage.tsx`
- `/src/pages/StoryDetailPage.tsx`
- `/src/hooks/useAuth.ts`
- `/src/components/auth/AuthGuard.tsx`
- `/firestore.rules`

Ezeknél:
- ne legyen felesleges nagy refaktor
- mindig ellenőrizd a fő user flow-kat

## 8. Board / drag-and-drop szabályok

- A board drag-and-drop regresszióérzékeny.
- Ugyanazon oszlopon belüli sorrendezés különösen kényes.
- Ha ezen a részen változtatsz, mindig ellenőrizd:
  - ugyanazon oszlopon belüli újrarendezés
  - másik oszlopba húzás
  - backlogból boardra húzás
  - több oszlopos, vízszintesen görgetett board
  - lista végi drop

## 9. Commit szabályok

- Csak az adott feladathoz tartozó fájlok kerüljenek commitba.
- Commit előtt mindig:
  - `git status --short`
- Ne kerüljön be véletlenül:
  - user manual export
  - félkész tesztfájl
  - ideiglenes debug módosítás

## 10. Dokumentáció és kontextus

- Új sessionben ezt a fájlt és az `agent.md`-t el kell olvasni.
- A `PLAN.md` a nagyobb termékirányt rögzíti.
- Ha nagyobb új funkció készül, érdemes röviden dokumentálni a jelenlegi állapotot vagy döntést.

## 11. Prioritás új fejlesztéseknél

Alapértelmezett sorrend:

1. stabilitás
2. jogosultság és adatbiztonság
3. kulcs flow-k
4. UX finomítás
5. extra funkciók

