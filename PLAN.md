# Agile Task Management Software -- Teljes Tervezési Dokumentum

**Projekt:** Webtown Agile Task Management Software
**Dátum:** 2026-03-28
**Verzió:** 1.0
**Tech stack:** React + Vite + TypeScript | Firebase (Auth, Firestore, Storage, Cloud Functions) | Tailwind CSS

---

## Tartalomjegyzék

1. [Részletes Funkcionális Specifikáció](#1-részletes-funkcionális-specifikáció)
2. [Felhasználói Szerepkör Mátrix](#2-felhasználói-szerepkör-mátrix)
3. [Képernyők Listája](#3-képernyők-listája)
4. [Adatmodell](#4-adatmodell)
5. [Firestore Gyűjtemény Struktúra](#5-firestore-gyűjtemény-struktúra)
6. [Fő Felhasználói Folyamatok](#6-fő-felhasználói-folyamatok)
7. [MVP vs Fázis 2 Bontás](#7-mvp-vs-fázis-2-bontás)
8. [Technikai Architektúra Összefoglaló](#8-technikai-architektúra-összefoglaló)
9. [UI Komponens Lista](#9-ui-komponens-lista)
10. [Elfogadási Kritériumok](#10-elfogadási-kritériumok)

---

## 1. Részletes Funkcionális Specifikáció

### 1.1 Hitelesítés és Meghívó Rendszer (Auth)

**Mit csinál:**
- Email/jelszó és Google OAuth bejelentkezés Firebase Auth-on keresztül
- Meghívó-alapú regisztráció: csak meghívott felhasználók férhetnek hozzá szervezeti adatokhoz
- Szervezetváltás többszervezetes felhasználók számára

**Fő viselkedések és szabályok:**
- Bárki létrehozhat Firebase Auth fiókot, de szervezeti adatokhoz csak elfogadott meghívóval rendelkező felhasználók férnek hozzá
- Admin meghívót küld email címre + szerepkör megjelöléssel
- A meghívó 7 napig érvényes, utána lejár
- Meghívó elfogadásakor Cloud Function beállítja a custom claims-t (orgId, orgRole)
- Token refresh szükséges custom claims változáskor
- Jelszó-visszaállítás Firebase Auth beépített folyamatán keresztül

**Edge case-ek:**
- Felhasználó regisztrál meghívó nélkül: "Nincs szervezeti tagság" képernyő jelenik meg
- Lejárt meghívó: hibaüzenet, Admin újra tud küldeni
- Felhasználó több szervezethez tartozik: szervezetváltó dropdown a fejlécben, Cloud Function frissíti a custom claims-t
- Email cím ütközés: ha már létezik Auth fiók, a meghívó elfogadásakor a meglévő fiókhoz kapcsolódik

### 1.2 Backlog Kezelés

**Mit csinál:**
- Projekt szintű, priorizált story lista háromszekciós megjelenítéssel (Scrummate minta)
- Három szekció: **On Board** (felül, read-only), **Planbox** (középen, puffer zóna), **Backlog** (alul, fő lista)

**Fő viselkedések és szabályok:**
- **Backlog szekció:**
  - Drag-and-drop sorrend (fractional indexing)
  - Divider-ek (vizuális elválasztók, pl. "Sprint 5 jelöltek")
  - Group-ok (csoportosítás topic/tag szerint)
  - Szűrés tag, topic, assignee, prioritás, státusz szerint
  - Bulk műveletek: több story kijelölése, áthelyezés Planbox-ba, tag hozzáadás
- **Planbox szekció:**
  - Pull-alapú: PO ide helyezi a következő sprintbe szánt story-kat
  - Team a board-ról húzza be (nem push, hanem pull modell)
  - Saját rendezés (független a backlog sorrendtől)
- **On Board szekció:**
  - Read-only nézet a jelenleg bármely team board-ján lévő story-król
  - Mutatja melyik team board-ján van, melyik oszlopban
  - Kattintásra megnyitja a story részleteit

**Edge case-ek:**
- Team leválasztása projektről: a board-on lévő story-k visszakerülnek a backlog-ba
- Story törlése ami board-on van: megerősítő dialog, task-ok is törlődnek
- Párhuzamos drag-and-drop: optimistic update + Firestore conflict resolution
- Üres backlog: onboarding segédlet megjelenítése

### 1.3 Planbox

**Mit csinál:**
- Köztes puffer zóna a backlog és a board között
- PO ide helyezi a következő sprint/iteráció jelöltjeit
- Team innen húzza a board-ra a feladatokat

**Fő viselkedések és szabályok:**
- PO (write jogosultsággal) mozgathat story-kat Backlog <-> Planbox között
- Planbox-ban saját sorrend, independent a backlog sorrendtől
- Story-nak location mezője: backlog | planbox | board
- Planbox-ból board-ra húzáskor a story oszlop-hozzárendelést kap
- Estimate kötelező Planbox-ba helyezés előtt (konfigurálható szabály)

**Edge case-ek:**
- Story visszahúzása board-ról Planbox-ba: task-ok megmaradnak, oszlop hozzárendelés törlődik
- Üres Planbox: "Húzz ide story-kat a backlog-ból" placeholder

### 1.4 Board (Tábla)

**Mit csinál:**
- Kanban-stílusú tábla testreszabható oszlopokkal
- Támogatja a Scrum sprint és Kanban flow módokat
- Realtime frissítés Firestore onSnapshot listener-ekkel

**Fő viselkedések és szabályok:**
- **Oszlopok:**
  - Admin/Manager hozhat létre, törölhet, átnevezhet oszlopokat
  - Alapértelmezett oszlopok: To Do, In Progress, Review, Done
  - WIP limit oszloponként (figyelmeztetés és/vagy blokkolás ha eléri)
  - Oszlop sorrend drag-and-drop-pal állítható
- **Kanban mód:**
  - Folyamatos áramlás, nincs sprint határ
  - Done oszlopba kerülő story-k automatikusan "Delivered" státuszt kapnak
- **Scrum mód:**
  - Sprint indítás: cél megadása + végdátum
  - Aktív sprint jelzés: board fejléc kék háttér
  - Sprint befejezés (Process Master/Admin jog):
    - Done oszlopban lévő story-k -> "Delivered" státusz
    - Nem kész story-k -> választás: visszakerülnek backlog-ba VAGY maradnak a következő sprintre
  - Sprint history megőrzése reporting-hoz
- **Story kártyák a board-on:**
  - Cím, assignee avatar, prioritás jelzés, estimate, tag-ek
  - Blocker indikátor (piros keret/ikon)
  - Subtask progress bar
  - Drag-and-drop oszlopok között és oszlopon belül

**Edge case-ek:**
- WIP limit túllépés: sárga figyelmeztetés, board-on sárgul az oszlop fejléc
- Story mozgatás jogosultság nélkül: hibaüzenet
- Offline módban végzett mozgatás: optimistic update, szinkronizálás visszakapcsoláskor
- Több team board-ja ugyanazon projekt story-ival: egy story egyszerre csak egy board-on lehet

### 1.5 Story és Task Kezelés

**Mit csinál:**
- Story = kimenet/érték (ügyfél számára látható eredmény)
- Task = tevékenység egy story alatt (soha nem önálló)
- Teljes CRUD mindkettőhöz

**Fő viselkedések és szabályok:**
- **Story mezők:**
  - Cím (kötelező), leírás (rich text), típus (feature/bug/tech debt/chore)
  - Prioritás (critical/high/medium/low), estimate (story points vagy T-shirt)
  - Assignee(s), reporter, tag-ek, topic/kategória
  - Due date, linked stories, blocker flag
  - Státusz: draft -> ready -> in_progress -> review -> done -> delivered
  - Location: backlog | planbox | board
  - Ha board-on van: boardId, columnId, columnOrder (fractional index)
- **Task mezők:**
  - Cím (kötelező), leírás, assignee, done boolean
  - Sorrend (fractional index a story-n belül)
  - Estimate (óra), due date
- **Közös funkciók:**
  - Comment-ek (threaded)
  - Attachment-ek (Firebase Storage)
  - Tag-ek
  - Worklog bejegyzések
  - Activity log (ki mit módosított, mikor)

**Edge case-ek:**
- Story törlése task-okkal: megerősítő dialog, kaszkád törlés
- Task hozzáadása lezárt story-hoz: figyelmeztetés, de engedélyezett
- Story áthelyezése másik projektbe: write jogosultság szükséges mindkét projektben
- Linked story törlése: a link törlődik, nem a másik story

### 1.6 Worklog / Időkövetés

**Mit csinál:**
- Munkaidő rögzítése story-kra és task-okra
- Rugalmas időbevitel (perc, óra, nap)
- Riportok alapja

**Fő viselkedések és szabályok:**
- Bármely Developer/PO rögzíthet worklog-ot hozzárendelt story-kra/task-okra
- Beviteli formátum: "30m", "1.5h", "1d" (1d = 8h konfigurálható)
- Mezők: userId, duration (percben tárolva), date, description, storyId/taskId
- Saját worklog-ot bárki törölheti, másét csak Admin
- Napi összesítés megjelenítése a felhasználónak
- Heti nézet time-sheet stílusban

**Edge case-ek:**
- 24 óránál több rögzítése egy napra: figyelmeztetés, de engedélyezett
- Worklog rögzítése múltbeli dátumra: engedélyezett (max 30 nap visszamenőleg)
- Worklog törlése lezárt sprintben: Admin jogosultság szükséges

### 1.7 Riportok

**Mit csinál:**
- Projekt és szervezeti szintű riportok különböző nézőpontokból
- Előre aggregált adatokon alapul (write-time aggregation)

**Riport típusok:**

| Riport | Leírás | Hozzáférés |
|--------|--------|------------|
| Projekt worklog | Összes logolt idő projektenként, story-nként bontva | Admin, PO |
| User worklog | Felhasználónkénti logolt idő időszakra | Admin, saját: Dev |
| Team kapacitás | Team tagok terheltsége assigned story pointok alapján | Admin, PO |
| Sprint összefoglaló | Commitment vs completed, velocity, burndown | Admin, PO |
| Backlog összefoglaló | Story-k száma státusz/prioritás/topic szerint | Admin, PO, Client (korlátozott) |
| Estimated vs Actual | Becsült vs tényleges idő story-nként | Admin, PO |
| Velocity chart | Sprint velocity trend (utolsó 10 sprint) | Admin, PO |
| Burndown chart | Napi remaining points sprint alatt | Admin, PO |

**Edge case-ek:**
- Nincs elég sprint adat velocity chart-hoz: "Legalább 2 lezárt sprint szükséges" üzenet
- Felhasználó elhagyja a szervezetet: historikus worklog adatok megmaradnak

### 1.8 Értesítések (Notifications)

**Mit csinál:**
- In-app értesítések releváns eseményekről
- Értesítési központ a fejlécben

**Fő viselkedések és szabályok:**
- Értesítés típusok:
  - Story hozzárendelés/eltávolítás
  - Comment az assignált story-n/task-on
  - Story státuszváltozás (ha assignee vagy reporter vagyok)
  - Megemlítés (@mention) comment-ben
  - Sprint indítás/befejezés (team tagok)
  - Meghívó érkezett
- Olvasott/olvasatlan jelölés
- Bulk "mind olvasottnak jelölés"
- Kattintásra navigáció az érintett elemhez
- Cloud Function írja az értesítéseket a /users/{userId}/notifications subcollection-be

**Edge case-ek:**
- Saját művelet nem generál értesítést (nem értesítem magam)
- Felhasználó elhagyja a szervezetet: értesítések megmaradnak de a linkek "törölt elem"-re mutatnak

### 1.9 Kliens Portál Nézet

**Mit csinál:**
- Egyszerűsített, read-only projekt nézet az ügyfél (Client) szerepkör számára
- Átlátható státusz áttekintés technikai részletek nélkül

**Fő viselkedések és szabályok:**
- Egyszerűsített backlog nézet: story cím, típus, státusz, prioritás
- Projekt progress dashboard: összesített számok, diagramok
- Opcionális kommentelés (szervezeti beállítás)
- Nincs hozzáférés: board részletek, task-ok, worklog, team struktúra
- Szűrés: story típus és státusz szerint
- Értesítés story státuszváltozáskor (ha engedélyezett)

**Edge case-ek:**
- Client megpróbál story-t szerkeszteni: UI nem jelenít meg szerkesztési lehetőséget
- Client hozzáférése projekthez megvonva: azonnal nem lát projekt adatot

### 1.10 Keresés és Szűrés

**Mit csinál:**
- Globális keresés story-k, task-ok, comment-ek között
- Kontextusfüggő szűrés (backlog, board, riportok)

**Fő viselkedések és szabályok:**
- Globális keresőmező a fejlécben (Ctrl/Cmd+K gyorsbillentyű)
- Keresés: story cím, leírás, task cím, comment szöveg
- Szűrők (kombinálhatók):
  - Projekt, Team
  - Assignee, Reporter
  - Státusz, Prioritás
  - Tag, Topic/Kategória
  - Típus (feature/bug/tech debt/chore)
  - Sprint
  - Dátum tartomány
- Szűrők menthetők "Saved filter" néven
- Backlog szűrés kliens-oldalon történik (az összes story betöltve van)
- Cross-project keresés Firestore collection group query-vel

**Edge case-ek:**
- Nagyon sok találat: paginálás (20 elem/oldal)
- Keresés jogosultság figyelembevételével: csak olyan elemek jelennek meg amelyekhez van read hozzáférés

---

## 2. Felhasználói Szerepkör Mátrix

### 2.1 Szervezeti szintű szerepkörök

| Művelet | Admin | Standard (PO/Dev) | Client |
|---------|-------|--------------------|--------|
| Szervezet beállítások kezelése | igen | nem | nem |
| Felhasználók meghívása | igen | nem | nem |
| Felhasználók eltávolítása | igen | nem | nem |
| Szerepkörök módosítása | igen | nem | nem |
| Projekt létrehozása | igen | igen | nem |
| Team létrehozása | igen | igen | nem |
| Összes riport megtekintése | igen | nem | nem |
| Audit log megtekintése | igen | nem | nem |

### 2.2 Projekt szintű jogosultságok (read/write/manage)

| Művelet | manage | write | read |
|---------|--------|-------|------|
| Projekt beállítások módosítása | igen | nem | nem |
| Projekt törlése | igen | nem | nem |
| Team hozzárendelés/leválasztás | igen | nem | nem |
| Story CRUD | igen | igen | nem |
| Story priorizálás (backlog sorrend) | igen | igen | nem |
| Planbox kezelés | igen | igen | nem |
| Story áthelyezés board-ra | igen | igen | nem |
| Comment írás | igen | igen | konfigurálható |
| Attachment feltöltés | igen | igen | nem |
| Backlog megtekintés | igen | igen | igen |
| Riportok megtekintés | igen | igen | igen (korlátozott) |
| Worklog rögzítés | igen | igen | nem |

### 2.3 Team Board szintű jogosultságok (read/write/manage)

| Művelet | manage | write | read |
|---------|--------|-------|------|
| Board oszlopok kezelése | igen | nem | nem |
| WIP limitek beállítása | igen | nem | nem |
| Sprint indítás/befejezés | igen | nem | nem |
| Story mozgatás oszlopok között | igen | igen | nem |
| Task CRUD | igen | igen | nem |
| Task státusz módosítás | igen | igen | nem |
| Board megtekintés | igen | igen | igen |

### 2.4 Tipikus szerepkör-jogosultság összerendelés

| | Admin | PO | Developer | Client |
|---|-------|-----|-----------|--------|
| Org role | admin | standard | standard | client |
| Projekt hozzáférés (tipikus) | manage | write/manage | write | read |
| Team Board hozzáférés (tipikus) | manage | read/write | write | - |

---

## 3. Képernyők Listája

### 3.1 Publikus képernyők (nem autentikált)

| # | Képernyő | Útvonal (hash) | Leírás |
|---|----------|-----------------|--------|
| 1 | Login | #/login | Email/jelszó és Google bejelentkezés |
| 2 | Regisztráció | #/register | Fiók létrehozás (email/jelszó) |
| 3 | Jelszó visszaállítás | #/forgot-password | Email megadás, reset link küldés |
| 4 | Meghívó elfogadás | #/invite?token=xxx | Meghívó validálás, regisztráció/bejelentkezés |

### 3.2 Fő alkalmazás képernyők

| # | Képernyő | Útvonal (hash) | Leírás |
|---|----------|-----------------|--------|
| 5 | Dashboard (My Work) | #/ | Személyes áttekintés: hozzárendelt story-k, mai feladatok, legutóbbi aktivitás |
| 6 | Projekt lista | #/projects | Összes elérhető projekt kártyás/lista nézet |
| 7 | Projekt Dashboard | #/projects/:projectId | Projekt összefoglaló: statisztikák, utolsó aktivitás, progress |
| 8 | Backlog | #/projects/:projectId/backlog | Háromszekciós backlog (On Board / Planbox / Backlog) |
| 9 | Board | #/teams/:teamId/board | Kanban tábla oszlopokkal, story kártyákkal |
| 10 | Story részletek | #/projects/:projectId/stories/:storyId | Story teljes nézet: leírás, task-ok, comment-ek, worklog, activity |
| 11 | Sprint nézet | #/teams/:teamId/sprints | Sprint lista, aktív sprint részletek, sprint history |
| 12 | Riportok | #/projects/:projectId/reports | Projekt riportok (típus választó + riport megjelenítés) |
| 13 | Szervezeti riportok | #/reports | Cross-project riportok (Admin) |

### 3.3 Kezelési képernyők

| # | Képernyő | Útvonal (hash) | Leírás |
|---|----------|-----------------|--------|
| 14 | Team lista | #/teams | Összes team, tagok, kapcsolt projektek |
| 15 | Team beállítások | #/teams/:teamId/settings | Team név, tagok kezelése, board oszlopok |
| 16 | Projekt beállítások | #/projects/:projectId/settings | Projekt név, tagok, team kapcsolatok, tag-ek/topic-ok |
| 17 | Szervezet beállítások | #/settings/organization | Szervezet név, logo, alapértelmezett beállítások |
| 18 | Felhasználó kezelés | #/settings/users | Meghívók, szerepkörök, felhasználó lista (Admin) |
| 19 | Profil beállítások | #/settings/profile | Saját profil, jelszó módosítás, értesítési preferenciák |

### 3.4 Kliens portál képernyők

| # | Képernyő | Útvonal (hash) | Leírás |
|---|----------|-----------------|--------|
| 20 | Kliens Dashboard | #/client | Egyszerűsített projekt áttekintés |
| 21 | Kliens Projekt nézet | #/client/projects/:projectId | Egyszerűsített backlog + progress |

### 3.5 Modális ablakok / Overlay-ek

| # | Komponens | Leírás |
|---|-----------|--------|
| 22 | Story létrehozás/szerkesztés modal | Teljes story form |
| 23 | Task létrehozás/szerkesztés inline | Inline form a story részleteknél |
| 24 | Worklog rögzítés modal | Idő, dátum, leírás |
| 25 | Sprint indítás modal | Cél, végdátum megadás |
| 26 | Sprint befejezés modal | Összefoglaló, nem kész story-k kezelése |
| 27 | Meghívó küldés modal | Email, szerepkör, projekt/team választás |
| 28 | Globális keresés overlay | Cmd+K keresőmező |
| 29 | Értesítési panel | Slide-in panel a fejlécből |
| 30 | Szűrő panel | Backlog/board szűrő sidebar |

---

## 4. Adatmodell

### 4.1 Organization

```
Organization {
  id: string (auto)
  name: string
  slug: string (unique, URL-friendly)
  logoUrl?: string
  settings: {
    defaultEstimateType: "points" | "tshirt" | "hours"
    hoursPerDay: number (default: 8)
    clientCommentingEnabled: boolean
    estimateRequiredForPlanbox: boolean
  }
  plan: "free" | "pro" | "enterprise"
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 4.2 User

```
User {
  id: string (Firebase Auth UID)
  email: string
  displayName: string
  photoUrl?: string
  currentOrgId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 4.3 OrganizationMembership (User subcollection)

```
OrganizationMembership {
  id: string (orgId)  // doc ID = orgId
  orgName: string (denormalized)
  role: "owner" | "admin" | "standard" | "client"
  joinedAt: Timestamp
}
```

### 4.4 Project

```
Project {
  id: string (auto)
  name: string
  description?: string
  prefix: string (pl. "WEB", max 5 karakter, story azonosítóhoz: WEB-123)
  status: "active" | "archived"
  connectedTeamIds: string[] (denormalized)
  storyCount: number (denormalized, Cloud Function frissíti)
  nextSequenceNumber: number (auto-increment counter)
  settings: {
    storyTypes: string[] (default: ["feature", "bug", "tech_debt", "chore"])
    priorities: string[] (default: ["critical", "high", "medium", "low"])
  }
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 4.5 ProjectMembership (Project subcollection)

```
ProjectMembership {
  id: string (userId)  // doc ID = userId
  displayName: string (denormalized)
  email: string (denormalized)
  photoUrl?: string (denormalized)
  access: "read" | "write" | "manage"
  role: "po" | "developer" | "client" | "stakeholder"
  joinedAt: Timestamp
}
```

### 4.6 Team

```
Team {
  id: string (auto)
  name: string
  description?: string
  connectedProjectIds: string[] (denormalized)
  boardConfig: {
    mode: "kanban" | "scrum"
    columns: [
      {
        id: string
        name: string
        order: string (fractional index)
        wipLimit?: number
        color?: string
        isDoneColumn: boolean
      }
    ]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 4.7 TeamMembership (Team subcollection)

```
TeamMembership {
  id: string (userId)  // doc ID = userId
  displayName: string (denormalized)
  email: string (denormalized)
  photoUrl?: string (denormalized)
  access: "read" | "write" | "manage"
  joinedAt: Timestamp
}
```

### 4.8 Story

```
Story {
  id: string (auto)
  projectId: string
  sequenceNumber: number (auto-increment per project -> "WEB-123")
  title: string
  description?: string (rich text, HTML)
  type: "feature" | "bug" | "tech_debt" | "chore"
  priority: "critical" | "high" | "medium" | "low"
  status: "draft" | "ready" | "in_progress" | "review" | "done" | "delivered"
  location: "backlog" | "planbox" | "board"

  // Backlog/Planbox pozíció
  backlogOrder?: string (fractional index, csak ha location=backlog)
  planboxOrder?: string (fractional index, csak ha location=planbox)

  // Board pozíció (csak ha location=board)
  boardId?: string (teamId)
  columnId?: string
  columnOrder?: string (fractional index)

  // Hozzárendelések
  assigneeIds: string[]
  assigneeNames: string[] (denormalized)
  reporterId: string
  reporterName: string (denormalized)

  // Metaadatok
  estimate?: number (story points)
  estimateType?: "points" | "tshirt" | "hours"
  dueDate?: Timestamp
  tagIds: string[]
  topicId?: string
  sprintId?: string

  // Kapcsolatok
  linkedStoryIds: string[]
  isBlocked: boolean
  blockedByStoryIds: string[]

  // Denormalizált számlálók
  taskCount: number
  taskDoneCount: number
  commentCount: number
  totalWorklogMinutes: number

  // Audit
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 4.9 Task

```
Task {
  id: string (auto)
  storyId: string (parent ref)
  title: string
  description?: string
  isDone: boolean
  assigneeId?: string
  assigneeName?: string (denormalized)
  estimate?: number (óra)
  dueDate?: Timestamp
  order: string (fractional index)
  totalWorklogMinutes: number (denormalized)
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 4.10 Comment

```
Comment {
  id: string (auto)
  storyId: string (parent ref)
  parentCommentId?: string (threaded válasz esetén)
  authorId: string
  authorName: string (denormalized)
  authorPhotoUrl?: string (denormalized)
  body: string (rich text)
  mentions: string[] (userId-k)
  isEdited: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 4.11 Attachment

```
Attachment {
  id: string (auto)
  storyId: string
  taskId?: string (opcionális, ha task-hoz tartozik)
  fileName: string
  fileSize: number (bytes)
  mimeType: string
  storageUrl: string (Firebase Storage URL)
  uploadedBy: string (userId)
  uploadedByName: string (denormalized)
  createdAt: Timestamp
}
```

### 4.12 Tag

```
Tag {
  id: string (auto)
  name: string
  color: string (hex)
  createdAt: Timestamp
}
```

### 4.13 Topic (Kategória)

```
Topic {
  id: string (auto)
  name: string
  description?: string
  color?: string
  order: number
  createdAt: Timestamp
}
```

### 4.14 Sprint

```
Sprint {
  id: string (auto)
  teamId: string
  name: string (pl. "Sprint 14")
  goal?: string
  status: "planning" | "active" | "completed"
  startDate: Timestamp
  endDate: Timestamp
  completedAt?: Timestamp

  // Denormalizált statisztikák (Cloud Function frissíti)
  stats: {
    totalStories: number
    completedStories: number
    totalPoints: number
    completedPoints: number
    addedAfterStart: number
    removedDuringSprint: number
  }

  createdAt: Timestamp
  createdBy: string (userId)
}
```

### 4.15 DailySnapshot (Sprint burndown adatok)

```
DailySnapshot {
  id: string (dátum string: "2026-03-28")
  remainingPoints: number
  completedPoints: number
  addedPoints: number
  removedPoints: number
  totalStories: number
  completedStories: number
  snapshotAt: Timestamp
}
```

### 4.16 Worklog

```
Worklog {
  id: string (auto)
  storyId: string
  taskId?: string
  userId: string
  userName: string (denormalized)
  minutes: number
  date: string (YYYY-MM-DD formátum, kereshetőség miatt)
  description?: string
  createdAt: Timestamp
}
```

### 4.17 ActivityLog

```
ActivityLog {
  id: string (auto)
  entityType: "story" | "task" | "sprint" | "project" | "team"
  entityId: string
  action: "created" | "updated" | "deleted" | "moved" | "assigned" | "commented" | "status_changed"
  actorId: string
  actorName: string (denormalized)
  changes?: { field: string, oldValue: any, newValue: any }[]
  projectId: string
  createdAt: Timestamp
}
```

### 4.18 Notification

```
Notification {
  id: string (auto)
  type: "assigned" | "unassigned" | "commented" | "mentioned" | "status_changed" | "sprint_started" | "sprint_finished" | "invited"
  title: string
  body: string
  entityType: "story" | "task" | "sprint" | "project"
  entityId: string
  projectId?: string
  isRead: boolean
  actorId: string
  actorName: string (denormalized)
  createdAt: Timestamp
}
```

### 4.19 Invitation

```
Invitation {
  id: string (auto)
  email: string
  orgId: string
  orgName: string (denormalized)
  projectId?: string
  teamId?: string
  orgRole: "standard" | "client"
  projectAccess?: "read" | "write" | "manage"
  teamAccess?: "read" | "write" | "manage"
  projectRole?: "po" | "developer" | "client"
  token: string (UUID)
  status: "pending" | "accepted" | "expired" | "cancelled"
  invitedBy: string (userId)
  invitedByName: string (denormalized)
  expiresAt: Timestamp
  createdAt: Timestamp
}
```

### 4.20 ProjectStats (előre aggregált)

```
ProjectStats {
  id: "stats" (singleton a project subcollection-ben)
  totalStories: number
  storiesByStatus: { [status: string]: number }
  storiesByPriority: { [priority: string]: number }
  storiesByType: { [type: string]: number }
  totalPoints: number
  completedPoints: number
  totalWorklogMinutes: number
  updatedAt: Timestamp
}
```

### 4.21 Divider (Backlog szekció elválasztó)

```
Divider {
  id: string (auto)
  title: string
  backlogOrder: string (fractional index, a story-k közé kerül)
  color?: string
  createdAt: Timestamp
  createdBy: string (userId)
}
```

### 4.22 SavedFilter

```
SavedFilter {
  id: string (auto)
  name: string
  scope: "project" | "global"
  projectId?: string
  filters: {
    assigneeIds?: string[]
    statuses?: string[]
    priorities?: string[]
    types?: string[]
    tagIds?: string[]
    topicId?: string
    sprintId?: string
    dateFrom?: string
    dateTo?: string
    searchText?: string
  }
  createdBy: string (userId)
  createdAt: Timestamp
}
```

---

## 5. Firestore Gyűjtemény Struktúra

### 5.1 Teljes Gyűjtemény Hierarchia

```
/organizations/{orgId}
  +-- name, slug, settings, plan, createdAt, updatedAt, createdBy
  |
  +-- /projects/{projectId}
  |     +-- name, description, prefix, status, connectedTeamIds, storyCount, settings, ...
  |     |
  |     +-- /memberships/{userId}
  |     |     +-- displayName, email, photoUrl, access, role, joinedAt
  |     |
  |     +-- /stories/{storyId}
  |     |     +-- title, description, type, priority, status, location, ...
  |     |     |
  |     |     +-- /tasks/{taskId}
  |     |     |     +-- title, description, isDone, assigneeId, estimate, order, ...
  |     |     |
  |     |     +-- /comments/{commentId}
  |     |     |     +-- authorId, authorName, body, mentions, parentCommentId, ...
  |     |     |
  |     |     +-- /attachments/{attachmentId}
  |     |     |     +-- fileName, fileSize, mimeType, storageUrl, uploadedBy, ...
  |     |     |
  |     |     +-- /worklogs/{worklogId}
  |     |           +-- userId, userName, minutes, date, description, ...
  |     |
  |     +-- /dividers/{dividerId}
  |     |     +-- title, backlogOrder, color, ...
  |     |
  |     +-- /tags/{tagId}
  |     |     +-- name, color
  |     |
  |     +-- /topics/{topicId}
  |     |     +-- name, description, color, order
  |     |
  |     +-- /stats/current
  |     |     +-- totalStories, storiesByStatus, storiesByPriority, ...
  |     |
  |     +-- /activityLogs/{logId}
  |     |     +-- entityType, entityId, action, actorId, changes, ...
  |     |
  |     +-- /savedFilters/{filterId}
  |           +-- name, scope, filters, createdBy, ...
  |
  +-- /teams/{teamId}
  |     +-- name, description, connectedProjectIds, boardConfig, ...
  |     |
  |     +-- /memberships/{userId}
  |     |     +-- displayName, email, photoUrl, access, joinedAt
  |     |
  |     +-- /sprints/{sprintId}
  |           +-- name, goal, status, startDate, endDate, stats, ...
  |           |
  |           +-- /dailySnapshots/{dateString}
  |                 +-- remainingPoints, completedPoints, addedPoints, ...
  |
  +-- /invitations/{invitationId}
        +-- email, projectId, teamId, orgRole, token, status, expiresAt, ...

/users/{userId}
  +-- email, displayName, photoUrl, currentOrgId, ...
  |
  +-- /orgMemberships/{orgId}
  |     +-- orgName, role, joinedAt
  |
  +-- /notifications/{notificationId}
        +-- type, title, body, entityType, entityId, isRead, ...
```

### 5.2 Szükséges Firestore Indexek

**Composite indexek (manuálisan létrehozandók):**

```
// Backlog nézet: story-k project-en belül, location és sorrend szerint
Collection: organizations/{orgId}/projects/{projectId}/stories
Fields: location ASC, backlogOrder ASC

// Planbox nézet
Collection: organizations/{orgId}/projects/{projectId}/stories
Fields: location ASC, planboxOrder ASC

// Board nézet: story-k egy adott board-on oszlop és sorrend szerint
Collection: organizations/{orgId}/projects/{projectId}/stories
Fields: boardId ASC, columnId ASC, columnOrder ASC

// Story-k sprint szerint
Collection: organizations/{orgId}/projects/{projectId}/stories
Fields: sprintId ASC, status ASC

// Worklog riport: felhasználó + dátum tartomány
Collection Group: worklogs
Fields: userId ASC, date ASC

// Activity log: projekt + időrend
Collection: organizations/{orgId}/projects/{projectId}/activityLogs
Fields: createdAt DESC

// Értesítések: olvasatlan először, időrend
Collection: users/{userId}/notifications
Fields: isRead ASC, createdAt DESC

// Meghívók: email + státusz
Collection: organizations/{orgId}/invitations
Fields: email ASC, status ASC
```

### 5.3 Security Rules Minta

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // === HELPER FUNCTIONS ===

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOrgMember(orgId) {
      return isAuthenticated() && request.auth.token.orgId == orgId;
    }

    function isOrgAdmin(orgId) {
      return isOrgMember(orgId) && request.auth.token.orgRole in ['owner', 'admin'];
    }

    function getProjectAccess(orgId, projectId) {
      return get(/databases/$(database)/documents/organizations/$(orgId)/projects/$(projectId)/memberships/$(request.auth.uid)).data.access;
    }

    function hasProjectAccess(orgId, projectId, minAccess) {
      let access = getProjectAccess(orgId, projectId);
      return (minAccess == 'read' && access in ['read', 'write', 'manage']) ||
             (minAccess == 'write' && access in ['write', 'manage']) ||
             (minAccess == 'manage' && access == 'manage');
    }

    function getTeamAccess(orgId, teamId) {
      return get(/databases/$(database)/documents/organizations/$(orgId)/teams/$(teamId)/memberships/$(request.auth.uid)).data.access;
    }

    function hasTeamAccess(orgId, teamId, minAccess) {
      let access = getTeamAccess(orgId, teamId);
      return (minAccess == 'read' && access in ['read', 'write', 'manage']) ||
             (minAccess == 'write' && access in ['write', 'manage']) ||
             (minAccess == 'manage' && access == 'manage');
    }

    // === ORGANIZATIONS ===

    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow update: if isOrgAdmin(orgId);

      // --- Projects ---
      match /projects/{projectId} {
        allow read: if isOrgMember(orgId) && hasProjectAccess(orgId, projectId, 'read');
        allow create: if isOrgMember(orgId) && request.auth.token.orgRole != 'client';
        allow update: if isOrgAdmin(orgId) || hasProjectAccess(orgId, projectId, 'write');
        allow delete: if isOrgAdmin(orgId) || hasProjectAccess(orgId, projectId, 'manage');

        // Project memberships
        match /memberships/{userId} {
          allow read: if isOrgMember(orgId);
          allow write: if isOrgAdmin(orgId) || hasProjectAccess(orgId, projectId, 'manage');
        }

        // Stories
        match /stories/{storyId} {
          allow read: if isOrgMember(orgId) && hasProjectAccess(orgId, projectId, 'read');
          allow create: if hasProjectAccess(orgId, projectId, 'write');
          allow update: if hasProjectAccess(orgId, projectId, 'write');
          allow delete: if hasProjectAccess(orgId, projectId, 'manage');

          // Tasks, Comments, Attachments, Worklogs under stories
          match /{subcol}/{docId} {
            allow read: if isOrgMember(orgId) && hasProjectAccess(orgId, projectId, 'read');
            allow create: if hasProjectAccess(orgId, projectId, 'write');
            allow update: if hasProjectAccess(orgId, projectId, 'write');
            allow delete: if hasProjectAccess(orgId, projectId, 'write')
                          && (subcol != 'worklogs' || resource.data.userId == request.auth.uid || isOrgAdmin(orgId));
          }
        }

        // Tags, Topics, Dividers, Stats, ActivityLogs, SavedFilters
        match /{subcol}/{docId} {
          allow read: if isOrgMember(orgId) && hasProjectAccess(orgId, projectId, 'read');
          allow write: if hasProjectAccess(orgId, projectId, 'write');
        }
      }

      // --- Teams ---
      match /teams/{teamId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOrgMember(orgId) && request.auth.token.orgRole != 'client';
        allow update: if isOrgAdmin(orgId) || hasTeamAccess(orgId, teamId, 'manage');
        allow delete: if isOrgAdmin(orgId);

        match /memberships/{userId} {
          allow read: if isOrgMember(orgId);
          allow write: if isOrgAdmin(orgId) || hasTeamAccess(orgId, teamId, 'manage');
        }

        match /sprints/{sprintId} {
          allow read: if isOrgMember(orgId) && hasTeamAccess(orgId, teamId, 'read');
          allow create, update: if hasTeamAccess(orgId, teamId, 'manage');
          allow delete: if isOrgAdmin(orgId);

          match /dailySnapshots/{dateStr} {
            allow read: if isOrgMember(orgId) && hasTeamAccess(orgId, teamId, 'read');
            // Only Cloud Functions write snapshots
          }
        }
      }

      // --- Invitations ---
      match /invitations/{invitationId} {
        allow read: if isOrgAdmin(orgId) ||
                      resource.data.email == request.auth.token.email;
        allow create: if isOrgAdmin(orgId);
        allow update: if isOrgAdmin(orgId) ||
                       (resource.data.email == request.auth.token.email && resource.data.status == 'pending');
      }
    }

    // === USERS ===

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId;

      match /orgMemberships/{orgId} {
        allow read: if request.auth.uid == userId;
        // Only Cloud Functions write memberships
      }

      match /notifications/{notificationId} {
        allow read: if request.auth.uid == userId;
        allow update: if request.auth.uid == userId; // olvasottnak jelölés
        // Only Cloud Functions create notifications
      }
    }
  }
}
```

### 5.4 Fontos Security Rules Megjegyzések

- A get() hívások költségesek (1 document read / hívás, max 10/rule evaluation)
- Hot path-okon (board story read) a custom claims ellenőrzés ingyenes, a hasProjectAccess viszont 1 read
- Membership doc ID = userId, így exists() elegendő sok esetben
- Cloud Functions által írt dokumentumokhoz (stats, dailySnapshots, notifications) nincs client write rule
- Admin felülírás: isOrgAdmin() mindig megkerüli a resource-level ellenőrzést

---

## 6. Fő Felhasználói Folyamatok

### 6.1 Onboarding Folyamat

```
1. Admin regisztrál -> Firebase Auth fiók létrejön
2. Admin létrehoz szervezetet -> Cloud Function:
   a. Létrehozza /organizations/{orgId} dokumentumot
   b. Létrehozza alapértelmezett team-et
   c. Beállítja custom claims: { orgId, orgRole: "owner" }
   d. Létrehozza /users/{uid}/orgMemberships/{orgId}
3. Admin meghív felhasználókat:
   a. Invitation dokumentum létrejön
   b. Email küldés meghívó linkkel
4. Meghívott kattint linkre -> #/invite?token=xxx
   a. App validálja a token-t (nem lejárt, pending státusz)
   b. Felhasználó bejelentkezik vagy regisztrál
   c. Cloud Function:
      - Létrehozza membership-eket (org, project, team)
      - Beállítja custom claims
      - Frissíti invitation státuszt "accepted"-re
5. Felhasználó belép -> Dashboard megjelenik
```

### 6.2 Story Életciklus (Backlog -> Planbox -> Board -> Delivered)

```
1. PO létrehoz story-t (Story modal, location: "backlog")
   -> Story megjelenik a Backlog szekcióban

2. PO priorizál: drag-and-drop a backlog-on belül
   -> backlogOrder frissül (fractional index, 1 write)

3. PO áthelyezi Planbox-ba: drag-and-drop VAGY "Move to Planbox" gomb
   -> location: "planbox", planboxOrder beállítva
   -> Story eltűnik a Backlog szekcióból, megjelenik a Planbox-ban

4. Developer a Team Board-on "Pull from Planbox" funkciót használ
   VAGY PO drag-and-drop Planbox -> Board
   -> location: "board", boardId: teamId, columnId: első oszlop, columnOrder beállítva
   -> Story megjelenik a Board-on ÉS az "On Board" szekcióban a Backlog nézeten

5. Developer mozgatja a story-t oszlopok között (drag-and-drop)
   -> columnId és columnOrder frissül
   -> Realtime: minden board-néző azonnal látja

6. Developer Done oszlopba húzza
   -> status: "done"
   -> Ha Scrum mód: sprint befejezéskor -> "delivered"
   -> Ha Kanban mód: automatikusan "delivered"

7. Sprint befejezés (Scrum mód):
   a. Process Master kattint "Finish Sprint"
   b. Done oszlop story-k -> status: "delivered", location: "backlog" (archív)
   c. Nem kész story-k -> választás:
      - Vissza backlog-ba (location: "backlog")
      - Marad következő sprintre (board-on marad)
   d. Sprint stats véglegesítődik
```

### 6.3 Sprint Kezelés

```
1. Team Manager/Admin navigál: #/teams/:teamId/sprints
2. "New Sprint" -> Sprint létrehozás modal:
   - Név (auto-increment javaslattal)
   - Cél (opcionális)
   - Kezdő és végdátum
3. Story-k hozzáadása a sprinthez:
   - Board-on lévő story-k automatikusan a sprinthez tartoznak
   - Planbox-ból húzhatók story-k a board-ra
4. "Start Sprint" -> sprint.status: "active"
   - Board fejléc kék hátteret kap
   - Napi snapshot Cloud Function indul (scheduled)
5. Sprint közben:
   - Story-k mozgathatók a board-on
   - Új story-k hozzáadhatók (addedAfterStart counter nő)
   - Story-k eltávolíthatók (removedDuringSprint counter nő)
6. "Finish Sprint" -> Sprint befejezés modal:
   - Összefoglaló: X/Y story kész, Z pont teljesítve
   - Nem kész story-k listája, választás egyenként:
     [ ] Visszakerül backlog-ba
     [ ] Marad a következő sprintre
   - Megerősítés
7. Sprint lezárva -> sprint.status: "completed"
   - Végső stats mentve
   - Velocity history frissül
```

### 6.4 Worklog Rögzítés

```
1. Developer megnyitja story/task részletek nézetet
2. "Log Work" gombra kattint -> Worklog modal:
   - Idő bevitel: szabad szöveg ("30m", "1.5h", "1d") -> percre konvertálva
   - Dátum (alapértelmezett: ma, módosítható max 30 napra visszamenőleg)
   - Leírás (opcionális)
3. Mentés:
   - Worklog dokumentum létrejön a story/task subcollection-ben
   - Cloud Function frissíti: story.totalWorklogMinutes, task.totalWorklogMinutes
   - ActivityLog bejegyzés
4. Saját worklog törlése: "Delete" gomb a worklog bejegyzésen
   - Cloud Function csökkenti a számlálókat
5. Más felhasználó worklog-ját csak Admin törölheti
```

### 6.5 Riport Megtekintés

```
1. PO/Admin navigál: #/projects/:projectId/reports
2. Riport típus választás (tab-ok vagy dropdown):
   - Sprint összefoglaló -> burndown chart + statisztikák
   - Velocity -> trend chart utolsó 10 sprintről
   - Worklog -> táblázat: story/felhasználó bontás, dátum szűréssel
   - Backlog összefoglaló -> pie/bar chart-ok státusz/prioritás/típus szerint
   - Estimated vs Actual -> táblázat estimate és worklog összehasonlítással
3. Szűrés: dátum tartomány, sprint, felhasználó
4. Export: CSV letöltés (Fázis 2)
5. Adatforrás:
   - Burndown: /sprints/{sprintId}/dailySnapshots
   - Velocity: /sprints collection, stats mező
   - Worklog: collection group query worklogs-on
   - Backlog/project stats: /projects/{projectId}/stats/current
```

### 6.6 Kliens Hozzáférés

```
1. Admin meghívja a klienst (orgRole: "client", projectAccess: "read")
2. Kliens elfogadja meghívót -> bejelentkezés
3. Kliens Dashboard (#/client):
   - Projektek listája amihez hozzáférése van
   - Egyszerűsített kártyák: projekt név, progress bar, utolsó frissítés
4. Projekt nézet (#/client/projects/:projectId):
   - Egyszerűsített story lista (cím, típus, státusz, prioritás)
   - Nincs: task-ok, board, team, worklog, részletes beállítások
   - Progress dashboard: összesített számok
   - Opcionális kommentelés (ha org settings engedi)
5. Értesítések: story státuszváltozáskor (ha assignee vagy reporter)
```

---

## 7. MVP vs Fázis 2 Bontás

### MVP (Fázis 1) -- Becsült idő: 12-16 hét

| Modul | Tartalom |
|-------|----------|
| **Auth** | Email/jelszó + Google OAuth, meghívó rendszer, custom claims, szervezetváltás |
| **Szervezet** | CRUD, beállítások, felhasználó kezelés |
| **Projekt** | CRUD, membership kezelés, team hozzárendelés |
| **Team** | CRUD, membership kezelés, board konfiguráció |
| **Backlog** | Háromszekciós nézet (On Board / Planbox / Backlog), drag-and-drop, fractional indexing |
| **Planbox** | Köztes puffer zóna, story mozgatás backlog <-> planbox |
| **Board** | Kanban mód, oszlopok, drag-and-drop, WIP limit figyelmeztetés, realtime sync |
| **Story** | CRUD, minden mező, location váltás (backlog/planbox/board) |
| **Task** | CRUD story alatt, done/undone, sorrend |
| **Comment** | CRUD story-n, szerkesztés, @mention (jelölés, de értesítés nélkül) |
| **Attachment** | Feltöltés Firebase Storage-ba, megjelenítés, letöltés |
| **Sprint** | Létrehozás, indítás, befejezés, story kezelés sprint közben |
| **Worklog** | Rögzítés story/task-ra, saját worklog törlés |
| **Tag/Topic** | CRUD, story-khoz rendelés, szűrés |
| **Divider** | Backlog-on belüli vizuális elválasztók |
| **Keresés** | Globális keresés story cím/leírás alapján, Cmd+K |
| **Szűrés** | Backlog és board szűrők (assignee, status, priority, type, tag) |
| **Dashboard** | My Work nézet: hozzárendelt story-k, mai feladatok |
| **Értesítések** | In-app értesítések (assign, comment, status change), értesítési panel |
| **Riportok** | Sprint összefoglaló, backlog összefoglaló, egyszerű worklog riport |
| **Kliens nézet** | Read-only projekt nézet, egyszerűsített backlog |
| **Responsive** | Mobile-first, minden fő képernyő használható mobilon |
| **Offline** | Firestore offline persistence engedélyezve |

### Fázis 2 -- MVP után 8-12 hét

| Modul | Tartalom |
|-------|----------|
| **Riportok bővítés** | Burndown chart, velocity chart, estimated vs actual, team capacity, CSV export |
| **Értesítések bővítés** | @mention értesítés, email értesítések (SendGrid), értesítési preferenciák |
| **Keresés bővítés** | Szűrők mentése (Saved filters), cross-project keresés, keresés comment szövegben |
| **Activity Log** | Teljes audit trail, szűrhető activity log nézet |
| **Linked Stories** | Story-k közötti kapcsolatok (blocks, is blocked by, relates to) |
| **Blocker indikátor** | Vizuális blocker jelzés board kártyákon, blocker riport |
| **Bulk műveletek** | Több story kijelölés backlog-on, bulk tag/assignee/move |
| **Board bővítés** | Swimlane-ek (assignee vagy prioritás szerint), WIP limit hard block mód |
| **Worklog bővítés** | Heti timesheet nézet, worklog assistant, Admin worklog törlés |
| **Kliens bővítés** | Kliens kommentelés, progress dashboard diagramokkal |
| **Profil** | Avatar feltöltés, nyelvi beállítások |
| **Dark mode** | Sötét téma támogatás |
| **Keyboard shortcuts** | Board és backlog billentyűparancsok |
| **Webhooks** | Külső integráció events alapon |
| **Import/Export** | Projekt import CSV/JSON-ból, teljes projekt export |

### Fázis 3 -- Továbbfejlesztés

| Modul | Tartalom |
|-------|----------|
| **Email integráció** | Story létrehozás emailből |
| **GitHub/GitLab integráció** | Commit -> story hivatkozás, auto task lezárás |
| **AI funkciók** | Story leírás generálás, effort estimation, risk jelzés |
| **Többnyelvűség** | i18n framework, HU/EN |
| **Custom fields** | Felhasználó által definiált mezők story-khoz |
| **Workflow testreszabás** | Egyedi státusz workflow projekt szinten |
| **SSO** | SAML/OIDC enterprise SSO |

---

## 8. Technikai Architektúra Összefoglaló

### 8.1 Frontend Mappa Struktúra

```
src/
  main.tsx                       # App entry point
  App.tsx                        # Router setup, auth guard
  vite-env.d.ts

  config/
    firebase.ts                  # Firebase app initialization
    routes.ts                    # Route definitions
    constants.ts                 # App constants

  hooks/                         # Custom React hooks
    useAuth.ts                   # Firebase auth state
    useFirestore.ts              # Generic Firestore hooks
    useRealtimeCollection.ts     # onSnapshot wrapper
    useRealtimeDoc.ts            # Single doc listener
    useOrganization.ts           # Current org context
    useProject.ts                # Current project context
    useBoard.ts                  # Board state + realtime
    useBacklog.ts                # Backlog state
    useDragAndDrop.ts            # DnD logic wrapper
    usePermissions.ts            # Role/access checking
    useNotifications.ts          # Notification listener

  stores/                        # Zustand stores
    authStore.ts                 # Auth state, user, claims
    orgStore.ts                  # Current org, members
    projectStore.ts              # Active project data
    boardStore.ts                # Board columns, story positions
    uiStore.ts                   # Modals, sidebars, search state
    notificationStore.ts         # Notifications state

  services/                      # Firebase/business logic
    auth.service.ts              # Auth operations
    organization.service.ts      # Org CRUD
    project.service.ts           # Project CRUD
    team.service.ts              # Team CRUD
    story.service.ts             # Story CRUD + location changes
    task.service.ts              # Task CRUD
    comment.service.ts           # Comment CRUD
    attachment.service.ts        # File upload/download
    sprint.service.ts            # Sprint lifecycle
    worklog.service.ts           # Worklog CRUD
    invitation.service.ts        # Invite CRUD
    notification.service.ts      # Notification operations
    report.service.ts            # Report data fetching
    search.service.ts            # Search/filter logic

  components/
    ui/                          # Alap UI komponensek (lasd 9. fejezet)
      Button.tsx
      Input.tsx
      Modal.tsx
      ...

    layout/                      # Layout komponensek
      AppLayout.tsx              # Fő layout (sidebar + content)
      Sidebar.tsx
      Header.tsx
      MobileNav.tsx
      ClientLayout.tsx           # Kliens portál layout

    auth/                        # Auth komponensek
      LoginForm.tsx
      RegisterForm.tsx
      InviteAccept.tsx
      AuthGuard.tsx

    backlog/                     # Backlog nézet
      BacklogView.tsx
      BacklogSection.tsx
      PlanboxSection.tsx
      OnBoardSection.tsx
      StoryRow.tsx
      DividerRow.tsx
      BacklogFilters.tsx

    board/                       # Board nézet
      BoardView.tsx
      BoardColumn.tsx
      BoardCard.tsx
      BoardHeader.tsx
      ColumnSettings.tsx
      WipLimitBadge.tsx

    story/                       # Story komponensek
      StoryDetailView.tsx
      StoryForm.tsx
      StoryMetadata.tsx
      TaskList.tsx
      TaskItem.tsx
      CommentList.tsx
      CommentItem.tsx
      CommentForm.tsx
      AttachmentList.tsx
      WorklogList.tsx
      WorklogForm.tsx
      ActivityTimeline.tsx

    sprint/                      # Sprint komponensek
      SprintList.tsx
      SprintHeader.tsx
      SprintStartModal.tsx
      SprintFinishModal.tsx
      SprintSummary.tsx

    reports/                     # Riport komponensek
      ReportView.tsx
      BurndownChart.tsx
      VelocityChart.tsx
      WorklogReport.tsx
      BacklogSummary.tsx
      EstimateVsActual.tsx

    dashboard/                   # Dashboard
      DashboardView.tsx
      MyStories.tsx
      RecentActivity.tsx
      QuickActions.tsx

    settings/                    # Beállítások
      OrgSettings.tsx
      ProjectSettings.tsx
      TeamSettings.tsx
      UserManagement.tsx
      InviteModal.tsx
      ProfileSettings.tsx

    client/                      # Kliens portál
      ClientDashboard.tsx
      ClientProjectView.tsx

    notifications/               # Értesítések
      NotificationPanel.tsx
      NotificationItem.tsx
      NotificationBadge.tsx

    search/                      # Keresés
      GlobalSearchOverlay.tsx
      SearchResults.tsx
      FilterPanel.tsx

  pages/                         # Route-level page komponensek
    LoginPage.tsx
    RegisterPage.tsx
    ForgotPasswordPage.tsx
    InvitePage.tsx
    DashboardPage.tsx
    ProjectListPage.tsx
    ProjectDashboardPage.tsx
    BacklogPage.tsx
    BoardPage.tsx
    StoryDetailPage.tsx
    SprintPage.tsx
    ReportPage.tsx
    OrgReportPage.tsx
    TeamListPage.tsx
    TeamSettingsPage.tsx
    ProjectSettingsPage.tsx
    OrgSettingsPage.tsx
    UserManagementPage.tsx
    ProfilePage.tsx
    ClientDashboardPage.tsx
    ClientProjectPage.tsx
    NotFoundPage.tsx

  types/                         # TypeScript típus definíciók
    models.ts                    # Entity interfaces
    enums.ts                     # Enum típusok
    firebase.ts                  # Firebase specifikus típusok
    ui.ts                        # UI state típusok

  utils/                         # Utility függvények
    fractionalIndex.ts           # Fractional indexing logika
    permissions.ts               # Permission checking helpers
    formatters.ts                # Dátum, idő, szám formázók
    worklogParser.ts             # "30m", "1.5h", "1d" parser
    validators.ts                # Form validation
    firestore.ts                 # Firestore helper utilities

  styles/
    globals.css                  # Tailwind directives + custom styles
```

### 8.2 State Management Stratégia (Zustand)

**Alapelv:** Zustand store-ok a globális UI és auth állapothoz. Firestore realtime adatok custom hook-okban (nem store-ban), mert az onSnapshot listener-ek élettartama a komponens mount/unmount ciklusához kötött.

```
authStore:
  - user: User | null
  - claims: { orgId, orgRole } | null
  - loading: boolean
  - signIn(), signOut(), refreshClaims()

orgStore:
  - currentOrg: Organization | null
  - orgs: Organization[] (felhasználó szervezetei)
  - switchOrg(orgId)

uiStore:
  - sidebarOpen: boolean
  - activeModal: string | null
  - modalData: any
  - searchOpen: boolean
  - toggleSidebar(), openModal(), closeModal(), toggleSearch()

notificationStore:
  - unreadCount: number
  - notifications: Notification[]
  - markAsRead(id), markAllAsRead()
```

### 8.3 Routing (HashRouter)

```typescript
<HashRouter>
  <Routes>
    {/* Publikus */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/invite" element={<InvitePage />} />

    {/* Védett - AuthGuard */}
    <Route element={<AuthGuard />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
        <Route path="/projects/:projectId/stories/:storyId" element={<StoryDetailPage />} />
        <Route path="/projects/:projectId/reports" element={<ReportPage />} />
        <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
        <Route path="/teams" element={<TeamListPage />} />
        <Route path="/teams/:teamId/board" element={<BoardPage />} />
        <Route path="/teams/:teamId/sprints" element={<SprintPage />} />
        <Route path="/teams/:teamId/settings" element={<TeamSettingsPage />} />
        <Route path="/reports" element={<OrgReportPage />} />
        <Route path="/settings/organization" element={<OrgSettingsPage />} />
        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/profile" element={<ProfilePage />} />
      </Route>

      {/* Kliens portál - ClientLayout */}
      <Route element={<ClientLayout />}>
        <Route path="/client" element={<ClientDashboardPage />} />
        <Route path="/client/projects/:projectId" element={<ClientProjectPage />} />
      </Route>
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
</HashRouter>
```

### 8.4 Firebase Szolgáltatások

| Szolgáltatás | Használat |
|-------------|-----------|
| **Firebase Auth** | Email/jelszó + Google OAuth, custom claims |
| **Firestore** | Fő adatbázis, realtime listeners, offline persistence |
| **Firebase Storage** | Attachment-ek (képek, dokumentumok) |
| **Cloud Functions** | Invitation kezelés, custom claims, denormalizált adatok, értesítések, napi snapshot, worklog counter |
| **Firebase Hosting** | Opcionális (GitHub Pages az elsődleges), preview/staging |

### 8.5 Cloud Functions Lista

| Trigger | Funkció | Leírás |
|---------|---------|--------|
| onCreate invitation | onInvitationCreated | Meghívó email küldése |
| onCall | acceptInvitation | Token validálás, membership létrehozás, custom claims |
| onCall | switchOrganization | Custom claims frissítés másik org-ra |
| onWrite story | updateProjectStats | Projekt statisztikák frissítése |
| onWrite story (status) | createStatusNotification | Értesítés assignee/reporter-nek |
| onCreate comment | notifyOnComment | Értesítés story assignee-nek + @mention-öknek |
| onWrite worklog | updateWorklogCounters | Story/task totalWorklogMinutes frissítés |
| onWrite task | updateTaskCounters | Story taskCount/taskDoneCount frissítés |
| scheduled (daily) | createDailySprintSnapshot | Aktív sprint-ek napi burndown snapshot-ja |
| onUpdate user | syncDenormalizedUserData | Denormalizált nevek frissítése |
| onUpdate team.connectedProjectIds | onTeamDisconnected | Story-k visszahelyezése backlog-ba |

### 8.6 Realtime Sync Stratégia

**Listener-ek elhelyezése:**

| Nézet | Listener | Scope |
|-------|----------|-------|
| Board | onSnapshot stories query | where('boardId', '==', teamId) az adott projekt-en belül |
| Backlog | onSnapshot stories collection | Projekt összes story-ja (kliens oldali szűrés location szerint) |
| Story Detail | onSnapshot story doc + subcollections | Egy story doc + tasks + comments |
| Notifications | onSnapshot notifications query | where('isRead', '==', false) limit 20 |
| Sprint | onSnapshot active sprint doc | Egy aktív sprint doc |

**Optimistic Updates:**
- Drag-and-drop: lokális state azonnal frissül, Firestore write háttérben
- Ha write sikertelen: rollback + hibaüzenet
- onSnapshot visszakapja a végleges server state-et

**Offline kezelés:**
- persistentLocalCache + persistentMultipleTabManager
- Offline módosítások queue-ba kerülnek
- Visszakapcsoláskor automatikus sync
- "Offline" indikátor a fejlécben

### 8.7 Deployment Pipeline

```
GitHub Repository
  main branch push / PR merge
    GitHub Actions workflow:
      1. npm ci
      2. npm run lint
      3. npm run type-check
      4. npm run test
      5. npm run build (vite build, base: '/AgileTaskManagmentSoftware/')
      6. Copy index.html -> 404.html (SPA fallback)
      7. Deploy to GitHub Pages (gh-pages branch)

Firebase (külön deploy):
  - firebase deploy --only firestore:rules
  - firebase deploy --only functions
  - firebase deploy --only storage
```

### 8.8 Drag-and-Drop Implementáció

**Ajánlott könyvtár:** @dnd-kit/core + @dnd-kit/sortable

**Miért dnd-kit:**
- Natív React, hook-alapú API
- Kiváló accessibility (keyboard DnD)
- Több container közötti mozgatás (oszlopok között, backlog <-> planbox)
- Collision detection stratégiák (closestCenter, closestCorners)
- Touch support (mobil)
- Kis bundle size

**Fractional Indexing:**
- fractional-indexing npm csomag
- Új sorrend: generateKeyBetween(before, after) -> string kulcs
- Egyetlen document write per mozgatás
- Alphabet: base-62 (a-z, A-Z, 0-9)

---

## 9. UI Komponens Lista

### 9.1 Alap UI Komponensek

| Komponens | Props | Leírás |
|-----------|-------|--------|
| Button | variant, size, loading, disabled, icon | Primary/secondary/ghost/danger gombok |
| IconButton | icon, size, tooltip | Csak ikont tartalmazó gomb |
| Input | type, label, error, helper | Text/email/password/number input |
| Textarea | label, error, rows | Többsoros szöveges bevitel |
| Select | options, value, placeholder | Dropdown választó |
| MultiSelect | options, values | Több elem választása |
| Checkbox | checked, label | Jelölőnégyzet |
| Toggle | checked, label | Kapcsoló |
| RadioGroup | options, value | Rádiógomb csoport |
| Modal | isOpen, onClose, title, size | Modális ablak |
| Drawer | isOpen, onClose, side | Kihúzható panel (jobb/bal) |
| DropdownMenu | trigger, items | Legördülő menü |
| ContextMenu | items | Jobb-klikk menü |
| Tooltip | content, position | Tooltip |
| Badge | variant, count | Számláló/státusz jelző |
| Avatar | src, name, size | Felhasználó avatar |
| AvatarGroup | users, max | Több avatar egymás mellett |
| Tag | label, color, removable | Címke |
| Tabs | items, activeTab | Tab navigáció |
| Breadcrumb | items | Breadcrumb navigáció |
| EmptyState | icon, title, description, action | Üres állapot placeholder |
| LoadingSpinner | size | Töltés indikátor |
| Skeleton | variant | Tartalom betöltés placeholder |
| Toast | type, message, action | Felugró értesítés |
| ConfirmDialog | title, message, onConfirm | Megerősítő dialog |
| DatePicker | value, onChange, minDate, maxDate | Dátum választó |
| SearchInput | value, onChange, placeholder | Keresőmező ikonnal |
| RichTextEditor | value, onChange | Egyszerű rich text szerkesztő (bold, italic, list, link) |
| FileUpload | onUpload, accept, maxSize | Fájl feltöltő (drag-and-drop zóna) |
| ProgressBar | value, max, color | Haladásjelző sáv |
| Pagination | page, totalPages, onChange | Lapozó |

### 9.2 Domain-Specifikus Komponensek

| Komponens | Leírás |
|-----------|--------|
| StoryCard | Board kártya: cím, assignee, priority, estimate, tags, blocker, subtask progress |
| StoryRow | Backlog sor: cím, metadata, drag handle |
| StoryForm | Story létrehozás/szerkesztés teljes form |
| StoryQuickCreate | Inline story létrehozás (csak cím + típus) |
| TaskItem | Task sor: checkbox, cím, assignee, inline szerkesztés |
| TaskInlineForm | Inline task hozzáadás |
| CommentBubble | Comment megjelenítés: avatar, név, idő, szöveg, szerkesztés/törlés |
| WorklogEntry | Worklog bejegyzés sor: idő, dátum, leírás, törlés |
| WorklogQuickAdd | Gyors worklog rögzítés inline |
| SprintBanner | Aktív sprint jelző: név, cél, hátralévő napok, progress |
| BoardColumn | Kanban oszlop: fejléc, kártya lista, DnD target |
| BoardColumnHeader | Oszlop fejléc: név, kártya szám, WIP limit, beállítások |
| DividerItem | Backlog divider: szerkeszthető cím, szín, drag handle |
| PriorityIcon | Prioritás ikon (critical=piros, high=narancs, medium=sárga, low=szürke) |
| StatusBadge | Státusz badge színkóddal |
| TypeIcon | Story típus ikon (feature/bug/tech_debt/chore) |
| EstimateBadge | Becslés megjelenítő |
| BlockerIndicator | Piros blocker jelzés |
| MemberSelector | Tag kiválasztó dropdown (avatar + név, multi-select) |
| TagSelector | Tag választó (meglévő + új létrehozás) |
| TopicSelector | Topic/kategória választó |
| NotificationItem | Értesítés elem: ikon, szöveg, időpont, olvasott/olvasatlan |
| ActivityItem | Activity log elem: ki, mit, mikor, entity link |
| ProjectCard | Projekt kártya: név, progress, story count |
| TeamCard | Team kártya: név, tag count, kapcsolt projektek |
| OrgSwitcher | Szervezetváltó dropdown a fejlécben |
| SearchCommandPalette | Cmd+K overlay: keresőmező + eredmények + navigáció |
| FilterBar | Aktív szűrők sáv (tag-ek formájában, törölhető) |
| FilterPanel | Szűrő panel: assignee, status, priority, type, tag, topic |

### 9.3 Chart Komponensek (Fázis 2)

| Komponens | Leírás |
|-----------|--------|
| BurndownChart | Line chart: ideal vs actual burndown |
| VelocityChart | Bar chart: sprint velocity trend |
| StatusPieChart | Pie chart: story-k státusz szerint |
| PriorityBarChart | Bar chart: story-k prioritás szerint |
| WorklogBarChart | Stacked bar chart: worklog felhasználónként |

---

## 10. Elfogadási Kritériumok

### 10.1 Hitelesítés és Meghívó Rendszer

| # | Kritérium |
|---|-----------|
| AC-AUTH-01 | Email/jelszó regisztráció után a felhasználó automatikusan bejelentkezik |
| AC-AUTH-02 | Google OAuth bejelentkezés egyetlen kattintással elérhető |
| AC-AUTH-03 | Szervezethez nem tartozó bejelentkezett felhasználó a "Nincs szervezeti tagság" képernyőt látja |
| AC-AUTH-04 | Admin meghívót tud küldeni email cím + szerepkör megadásával |
| AC-AUTH-05 | Meghívó link 7 nap után lejár és nem használható |
| AC-AUTH-06 | Meghívó elfogadása után a felhasználó azonnal hozzáfér a megadott projekthez/teamhez |
| AC-AUTH-07 | Több szervezethez tartozó felhasználó az org switcher-rel válthat szervezetek között |
| AC-AUTH-08 | Szervezetváltás után a custom claims és a UI frissül 3 másodpercen belül |
| AC-AUTH-09 | Jelszó-visszaállítás email 1 percen belül megérkezik |

### 10.2 Backlog

| # | Kritérium |
|---|-----------|
| AC-BKL-01 | A backlog nézet három szekciót jelenít meg: On Board (felül), Planbox (középen), Backlog (alul) |
| AC-BKL-02 | Story-k drag-and-drop-pal átrendezhetők a backlog szekción belül |
| AC-BKL-03 | Drag-and-drop művelet egyetlen Firestore write-ot generál (fractional indexing) |
| AC-BKL-04 | Szűrők (assignee, status, priority, type, tag) helyesen szűrik a megjelenített story-kat |
| AC-BKL-05 | On Board szekció read-only és mutatja melyik team board-ján van az adott story |
| AC-BKL-06 | Divider hozzáadható és pozícionálható a backlog-on belül |
| AC-BKL-07 | 200 story-s backlog betöltődik 2 másodpercen belül (gyorsítótárból azonnal) |

### 10.3 Planbox

| # | Kritérium |
|---|-----------|
| AC-PBX-01 | Story drag-and-drop-pal áthelyezhető Backlog <-> Planbox között |
| AC-PBX-02 | Planbox-nak saját sorrendi rendszere van, független a backlog sorrendtől |
| AC-PBX-03 | Ha a szervezeti beállítás megköveteli: estimate nélküli story nem helyezhető Planbox-ba (hibaüzenet) |
| AC-PBX-04 | Planbox-ból a board-ra húzott story automatikusan az első oszlopba kerül |

### 10.4 Board

| # | Kritérium |
|---|-----------|
| AC-BRD-01 | Board valós időben frissül ha másik felhasználó mozgat egy story-t (max 2 mp késés) |
| AC-BRD-02 | Story drag-and-drop-pal mozgatható oszlopok között és oszlopon belül |
| AC-BRD-03 | WIP limit túllépésekor az oszlop fejléc vizuálisan figyelmeztet (sárga háttér) |
| AC-BRD-04 | Board oszlopok hozzáadhatók, törölhetők, átnevezhetők és átrendezhetők (manage jog) |
| AC-BRD-05 | Scrum módban az aktív sprint header kék hátteret kap |
| AC-BRD-06 | Story kártyán látható: cím, assignee avatar, prioritás ikon, estimate, tag-ek, subtask progress |
| AC-BRD-07 | Board mobilon is használható (touch drag-and-drop, egymás alatti oszlopok) |
| AC-BRD-08 | Offline módban végzett módosítások szinkronizálódnak visszakapcsoláskor |

### 10.5 Story és Task

| # | Kritérium |
|---|-----------|
| AC-STR-01 | Story létrehozásakor minimum a cím és típus kötelező |
| AC-STR-02 | Story részletek nézetben az összes mező szerkeszthető (write jogosultsággal) |
| AC-STR-03 | Task-ok inline hozzáadhatók és a checkbox-szal done/undone jelölhetők |
| AC-STR-04 | Task sorrend drag-and-drop-pal módosítható |
| AC-STR-05 | Comment hozzáadása után az összes story subscriber értesítést kap |
| AC-STR-06 | @mention a comment-ben működik: felhasználó lista gépelés közben |
| AC-STR-07 | Attachment feltöltés drag-and-drop vagy fájl választóval, max 10MB/fájl |
| AC-STR-08 | Story azonosító (prefix + sequence, pl. "WEB-42") egyedi projekten belül |
| AC-STR-09 | Read jogosultsággal nem lehet story-t szerkeszteni (UI sem mutat szerkesztési lehetőséget) |

### 10.6 Sprint

| # | Kritérium |
|---|-----------|
| AC-SPR-01 | Sprint létrehozásakor név, kezdő- és végdátum kötelező |
| AC-SPR-02 | Egyszerre csak egy sprint lehet aktív team-enként |
| AC-SPR-03 | Sprint befejezéskor Done oszlop story-k "delivered" státuszt kapnak |
| AC-SPR-04 | Sprint befejezéskor nem kész story-kra egyenként választható: vissza backlog / marad |
| AC-SPR-05 | Sprint stats (commitment, completed, velocity) helyesen számítódnak |
| AC-SPR-06 | Csak manage jogosultságú felhasználó indíthat/fejezhet be sprint-et |

### 10.7 Worklog

| # | Kritérium |
|---|-----------|
| AC-WKL-01 | Worklog rögzíthető "30m", "1.5h", "1d" formátumban helyes konvertálással |
| AC-WKL-02 | Worklog rögzíthető múltbeli dátumra (max 30 nap) |
| AC-WKL-03 | Saját worklog törölhető, counter automatikusan frissül |
| AC-WKL-04 | Más felhasználó worklog-ját csak Admin törölheti |
| AC-WKL-05 | Story/task totalWorklogMinutes mindig konzisztens a worklog bejegyzésekkel |

### 10.8 Értesítések

| # | Kritérium |
|---|-----------|
| AC-NTF-01 | Story hozzárendeléskor az assignee értesítést kap |
| AC-NTF-02 | Comment hozzáadásakor a story assignee(s) és reporter értesítést kap |
| AC-NTF-03 | Saját művelet nem generál értesítést a végrehajtónak |
| AC-NTF-04 | Értesítési badge mutatja az olvasatlan számot a fejlécben |
| AC-NTF-05 | Értesítésre kattintva navigáció az érintett entitásra |
| AC-NTF-06 | "Mind olvasottnak jelölés" egyetlen kattintással |

### 10.9 Riportok

| # | Kritérium |
|---|-----------|
| AC-RPT-01 | Sprint összefoglaló: commitment, completed, added, removed számok |
| AC-RPT-02 | Backlog összefoglaló: story megoszlás státusz, prioritás, típus szerint |
| AC-RPT-03 | Worklog riport szűrhető dátum és felhasználó szerint |
| AC-RPT-04 | Client csak backlog összefoglalót lát |
| AC-RPT-05 | Riport adatok 5 másodpercen belül betöltődnek |

### 10.10 Jogosultság és Biztonság

| # | Kritérium |
|---|-----------|
| AC-SEC-01 | Firestore security rules meggátolják az illetéktelen olvasást/írást |
| AC-SEC-02 | Client nem tud story-t módosítani Firestore-ban sem |
| AC-SEC-03 | Másik szervezet adataihoz nincs hozzáférés |
| AC-SEC-04 | Custom claims refresh 3 másodpercen belül |
| AC-SEC-05 | Projekt membership nélküli tag nem látja a projekt adatait |

### 10.11 Kliens Portál

| # | Kritérium |
|---|-----------|
| AC-CLT-01 | Client a #/client dashboard-ot látja, nem a normál dashboard-ot |
| AC-CLT-02 | Client egyszerűsített story listát lát (nincs task, worklog, board) |
| AC-CLT-03 | Client nem lát team struktúrát, board részleteket, worklog-ot |
| AC-CLT-04 | Ha engedélyezett: Client tud comment-et írni |

### 10.12 Teljesítmény és UX

| # | Kritérium |
|---|-----------|
| AC-PER-01 | Első betöltés 3 másodperc alatt (Lighthouse LCP) |
| AC-PER-02 | Oldalak közötti navigáció 500ms alatt (cache-elt adatokkal) |
| AC-PER-03 | Drag-and-drop 60fps |
| AC-PER-04 | Offline módban korábban betöltött adatok elérhetők |
| AC-PER-05 | 375px szélességen minden fő képernyő használható |
| AC-PER-06 | Cmd/Ctrl+K keresés overlay 200ms-en belül megjelenik |

---

## Implementációs Sorrend Javaslat (MVP)

| Hét | Sprint | Fókusz |
|-----|--------|--------|
| 1-2 | Sprint 0 | Projekt setup (Vite, Firebase, Tailwind, CI/CD), alapkomponensek, routing, auth |
| 3-4 | Sprint 1 | Szervezet/Projekt/Team CRUD, membership kezelés, meghívó rendszer |
| 5-6 | Sprint 2 | Story CRUD, Backlog nézet (háromszekciós), drag-and-drop, fractional indexing |
| 7-8 | Sprint 3 | Board nézet, oszlopok, realtime sync, Kanban drag-and-drop |
| 9-10 | Sprint 4 | Planbox, Sprint kezelés, story lifecycle (backlog->planbox->board->delivered) |
| 11-12 | Sprint 5 | Task, Comment, Attachment, Worklog, Értesítések |
| 13-14 | Sprint 6 | Riportok (MVP scope), Kliens portál, Keresés/Szűrés |
| 15-16 | Sprint 7 | Responsive finomhangolás, tesztelés, bug fix, deploy, dokumentáció |

---

*Dokumentum vége. Készítette: Claude Code Architect, 2026-03-28.*
