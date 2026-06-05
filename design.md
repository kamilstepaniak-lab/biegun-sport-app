# design.md — Design system (źródło prawdy o wyglądzie)

Źródło prawdy o wyglądzie aplikacji `biegun-sport-app`. Czytaj ten plik
przed każdym zadaniem dotyczącym UI / wyglądu.

Stack: Tailwind v4 (config w CSS, `src/app/globals.css`) + shadcn/ui (Radix)
+ lucide-react. Brak pliku `tailwind.config` — tokeny są w `@theme` i `:root`.

## Zasady nadrzędne

1. **Jeden spójny język wizualny** dla panelu admina i rodzica — te same
   tokeny, komponenty, radius, nagłówki. Różnią się treścią i nawigacją,
   nie wyglądem.
2. **Parytet analogicznych ekranów.** Ta sama strona w obu panelach
   (np. Wyjazdy u admina i Wyjazdy u rodzica, podobnie Płatności, Kalendarz,
   Umowy) to **warianty jednego widoku**: ten sam układ, te same karty,
   nagłówek i kolejność sekcji. Różnią się **tylko zakresem funkcji** —
   admin ma edycję/zarządzanie/akcje masowe, rodzic odczyt i akcje rodzica
   (potwierdzenie, wpłata, akceptacja umowy).
   - **Spójne wymiary.** Bloki, karty i wiersze danych mają mieć **te same
     szerokości, odstępy, padding i proporcje** po obu stronach — ten sam
     blok nie może być węższy/szerszy u rodzica niż u admina. Dane (kolumny,
     etykiety, wartości) układaj tak samo.
   - **Wspólne komponenty zamiast kopii.** Gdy ekran istnieje po obu stronach,
     wynoś powtarzalny widok (karta wyjazdu, tabela, blok podsumowania) do
     wspólnego komponentu i parametryzuj go uprawnieniami — nie utrzymuj
     dwóch rozjeżdżających się wersji.
   - Budując/zmieniając ekran po jednej stronie, **zawsze** sprawdź jego
     odpowiednik po drugiej i trzymaj je zgodne (układ, wymiary, wygląd).
   - **Zmiana na bliźniaczym ekranie = wdrożenie po obu stronach w tej samej
     turze.** Jeśli poprawiasz wygląd/układ podstrony, która ma odpowiednik
     w drugim panelu (Płatności, Kalendarz, Umowy/Dokumenty, Wyjazdy), nie
     zostawiaj drugiej „na potem" — od razu nanieś tę samą zmianę u admina
     i u rodzica. Nie pytaj o to za każdym razem.
3. **Komponenty zawsze z `src/components/ui`** (button, card, dialog, table,
   badge, input, select...). Najpierw szukaj istniejącego — nowy twórz tylko
   gdy naprawdę brak. **Zero inline ad-hoc styli** powielających to, co już
   jest w ui.
4. **Tylko jasny motyw.** Dark mode ignorujemy — nie dodawaj wariantów
   `dark:`, nie testuj dark. (Definicja `.dark` w globals.css jest martwa.)
5. **Oba urządzenia krytyczne.** Każdy ekran musi wyglądać dobrze na telefonie
   i na desktopie — sprawdzaj obie szerokości zanim powiesz „gotowe". To PWA
   (safe-area), panel rodzica używany głównie na telefonie.

## Kolory

- **Kolor wiodący (brand): niebieski `#2563eb`** (= `blue-600`). Tokeny shadcn
  `--primary` i `--ring` są przepisane na ten niebieski w globals.css, więc
  `bg-primary` i domyślny `Button` są już niebieskie. Dla statycznego brandu
  możesz używać `blue-600` zamiennie.
- **Neutralne: slate.** Tekst główny `#0f172a` (slate-900), tekst pomocniczy
  `#475569` (slate-600), wyciszony `#94a3b8`, linie/obramowania `#e2e8f0`,
  tło sekcji `#f8fafc`. Zmienne `--admin-*` w globals.css.
- **Statusy** (ujednolicony standard — używaj konsekwentnie):
  - sukces / opłacone → **emerald** (`bg-emerald-100` / `text-emerald-700`)
  - ostrzeżenie / do dopłaty → **amber** (`bg-amber-100` / `text-amber-700`)
  - błąd / po terminie → **red** (`bg-red-100` / `text-red-700`)
  - info / akcja → **blue** (`bg-blue-600` / `text-blue-700`)
  - Stare `green-*` zostało zmigrowane na `emerald-*` w całym `src/` —
    nie dokładaj nowych `green`.

## Ikony i kolory grup (kanon)

Każda grupa treningowa ma **stałą ikonę i stały kolor** — ten sam wszędzie
(Wyjazdy u rodzica, Uczestnicy/Grupy u admina, badge, avatary). Źródło prawdy:
- **Ikony:** `GroupIcon` / `GroupBadge` w `src/lib/group-icons.tsx`.
- **Kolory:** `getGroupColor` w `src/lib/group-colors.tsx` (bg / text / border / dot).

Mapowanie (po nazwie grupy, case-insensitive):

| Grupa | Ikona |
|---|---|
| Beeski | pszczółka (własny SVG) |
| ProKids | rakieta (`Rocket`) |
| SemiPRO | narty (własny SVG) |
| Hero | biceps (`BicepsFlexed`) |
| Pro | ogień (`Flame`) |

Nie hardkoduj ikon ani kolorów grup w komponentach — zawsze przez te dwa
helpery. Nowa grupa = dopisz przypadek w `group-icons.tsx` (i kolor w
`group-colors.tsx`), nie w miejscu użycia.

## Layout i nagłówki

- **`.page-header` to kanon na każdej podstronie** (admin i rodzic): tytuł
  + krótki opis + akcje. W `.admin-shell` ma jasny gradient z grafiką gór
  (`/parent-hero-mountains.svg`). Nie wymyślaj alternatywnych nagłówków.
- Radius: karty `14px` (`rounded-2xl` w admin-shell), mniejsze elementy `10px`.
  Cienie subtelne (`shadow-sm` = ledwie widoczny). Trzymaj się skali z globals.

## Ton tekstów UI

- **Admin = rzeczowo i krótko**, język produktowy, bez lania wody.
- **Rodzic = ciepło i przyjaźnie**, zachęcająco, zgodnie z Tone of Voice
  BiegunSport. Puste stany i komunikaty mają wspierać, nie tylko informować.
- Zawsze polski. Bez emoji (chyba że wprost poproszę).
