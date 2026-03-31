# Webtown Agile Task Management Software — Agent Context

Ez a fájl arra szolgál, hogy új sessionben is gyorsan felvehető legyen a projekt kontextusa.

## 1. Projekt röviden

- Név: Webtown Agile Task Management Software
- Cél: backlog, planbox, board, sprint, riport, worklog és szerepkör alapú együttműködés kezelése
- Stack:
  - React + Vite + TypeScript
  - Tailwind CSS
  - Firebase Auth
  - Firestore
  - Firebase Storage
  - GitHub Pages deploy

## 2. Fontos URL-ek

- GitHub repo: `https://github.com/kalmarpeterwebtown/webtowntask`
- GitHub Actions: `https://github.com/kalmarpeterwebtown/webtowntask/actions`
- GitHub Pages: `https://kalmarpeterwebtown.github.io/webtowntask/`
- Firebase project: `webtown-agile-task-management`

## 3. Helyi indítás

Projekt gyökér:

```bash
npm install
npm run dev
```

Ellenőrzés:

```bash
npm run test
npm run lint
npm run build
```

## 4. Deploy folyamat

Frontend / Pages:

```bash
git push origin main
```

Firestore rules:

```bash
firebase deploy --only firestore:rules --project webtown-agile-task-management
```

Storage rules:

```bash
firebase deploy --only storage --project webtown-agile-task-management
```

Megjegyzés:
- GitHub Pages csak a frontend buildet deployolja.
- Firebase rules deploy külön lépés, nem megy ki automatikusan a Pages-szel.

## 5. Fontos domain szabályok

- `pt` helyett mindenhol `SP` szóhasználat legyen.
- `Kliens` helyett `Ügyfél` szóhasználat legyen.
- Ügyfél jogosultság:
  - láthat projektet, boardot, storyt
  - worklogot nem láthat
  - worklogot nem írhat
- Jogosultsági szintek:
  - `read`: csak olvasás
  - `write`: napi munka, módosítás
  - `manage`: beállítások, tagságok, admin jellegű műveletek

## 6. Fontos adatstruktúra

Fő Firestore struktúra:

- `users/{userId}`
- `users/{userId}/notifications`
- `users/{userId}/orgMemberships`
- `organizations/{orgId}`
- `organizations/{orgId}/members`
- `organizations/{orgId}/projects`
- `organizations/{orgId}/projects/{projectId}/stories`
- `organizations/{orgId}/projects/{projectId}/stories/{storyId}/tasks`
- `organizations/{orgId}/projects/{projectId}/stories/{storyId}/comments`
- `organizations/{orgId}/projects/{projectId}/stories/{storyId}/worklogs`
- `organizations/{orgId}/projects/{projectId}/tags`
- `organizations/{orgId}/teams`
- `organizations/{orgId}/teams/{teamId}/sprints`
- `organizations/{orgId}/invitations`

## 7. Már elkészült fontosabb funkciók

- Auth és invite flow
- Org setup és membership fallbackek
- Projekt backlog
- Planbox
- Team board
- Drag and drop board + backlog panel
- Sprint panel, delivered lista, burndown
- Story detail
- Task kezelés
- Task assignee
- Story estimate
- Worklog storyhoz és taskhoz
- Riportok
- Notification panel
- Mention alapú értesítés
- Globális kereső
- Profil oldali jelszómódosítás
- GitHub Pages deploy
- Firestore rules hardening első köre

## 8. Jelenlegi nyitott / érzékeny pontok

- A board drag and drop sokat javult, de a saját oszlopon belüli sorrendezés volt a legproblémásabb terület.
- Ezen a részen különösen óvatosan kell módosítani:
  - `/src/pages/BoardPage.tsx`
  - collision detection
  - `handleDragOver`
  - `handleDragEnd`
  - `columnOrder` számítás
- A board logika több iterációban lett javítva, ezért regresszióveszélyes.

## 9. Fontos fájlok

- App routing: `/src/App.tsx`
- Firebase config: `/src/config/firebase.ts`
- Firestore rules: `/firestore.rules`
- Storage rules: `/storage.rules`
- Board: `/src/pages/BoardPage.tsx`
- Backlog: `/src/pages/BacklogPage.tsx`
- Story detail: `/src/pages/StoryDetailPage.tsx`
- Dashboard: `/src/pages/DashboardPage.tsx`
- User management: `/src/pages/UserManagementPage.tsx`
- Org auth/init: `/src/hooks/useAuth.ts`
- Auth guard: `/src/components/auth/AuthGuard.tsx`
- Search util: `/src/utils/search.ts`
- Project plan: `/PLAN.md`

## 10. Git és workspace állapot

Figyelem:
- a workspace lehet dirty
- soha ne revertálj user által készített változtatást kérés nélkül
- commit előtt ellenőrizni kell a `git status` kimenetet

Jelenleg tipikusan vannak olyan fájlok, amik nem feltétlen részei minden commitnak:

- `USER_MANUAL.docx`
- `USER_MANUAL.html`
- `USER_MANUAL.txt`
- `e2e/`
- `playwright.config.ts`

Mindig nézd meg, hogy az adott commit scope-jába tényleg beletartoznak-e.

## 11. Ajánlott munkamenet új sessionben

1. Olvasd el ezt a fájlt.
2. Nézd meg a `rules.md` fájlt.
3. Nézd meg a `PLAN.md`-t.
4. Futtasd:
   - `git status --short`
   - `npm run test`
   - `npm run lint`
5. Ha board / auth / invite részhez nyúlsz, különösen óvatosan ellenőrizd kézzel is.

