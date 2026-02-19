import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

// ─────────────────────────────────────────────────────────────────────────────
// SZABLON UMOWY (skrócony — OWU jest osobno na stronie /parent/owu)
// Placeholdery: {{trip_title}} {{trip_location}} {{trip_departure}} {{trip_return}}
//               {{child_name}} {{child_birth_date}}
//               {{parent_name}} {{parent_email}} {{parent_address}} {{parent_pesel}} {{parent_phone}}
//               {{payment_schedule}} {{trip_bank_pln}} {{trip_bank_eur}}
//               {{today_date}}
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRACT_TEMPLATE = `UMOWA OBOZU
zawarta w dniu {{today_date}} w Krakowie pomiędzy:

BIEGUNSPORT Stepaniak & Biegun sp. j. z siedzibą 30-731 Kraków ul. Grochowa 26C,
NIP 6772411396, REGON 366035549, wpisana do rejestru przedsiębiorstw KRS pod numerem 0000651048,
reprezentowana przez wspólnika Kamil Stepaniak, e-mail: biuro@biegunsport.pl.
Wpis do Centralnej Ewidencji Organizatorów Turystyki i Pośredników Turystycznych – 12165-12,
Certyfikat Gwarancji Ubezpieczeniowej TU Europa S.A. – GT 28/2019.
Dane kontaktowe ubezpieczyciela: Towarzystwo Ubezpieczeń Europa S.A., ul. Gwiaździsta 62,
53-413 Wrocław, e-mail: bok@tueuropa.pl, tel.: 801 500 300 lub 71 369 28 87,
adres strony internetowej: https://tueuropa.pl/
dalej zwanym „Organizatorem",
oraz

Pan / Pani: {{parent_name}}
Adres zamieszkania: {{parent_address}}
PESEL: {{parent_pesel}}
E-mail: {{parent_email}}
Telefon: {{parent_phone}}
zwany(a) dalej „Opiekunem";
zwanymi dalej łącznie „Stronami".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 1 – Przedmiot Umowy

1. Przedmiotem niniejszej umowy (dalej: „Umowa") jest zorganizowanie przez Organizatora na rzecz Uczestnika
   wyjazdu sportowo-rekreacyjnego (dalej: „Obóz"), obejmującego wyjazd: {{trip_title}},
   w terminie {{trip_departure}} – {{trip_return}}, w miejscowości {{trip_location}}.
2. Opiekun oświadcza, że kieruje na Obóz będącego pod jego opieką Uczestnika: {{child_name}},
   ur. {{child_birth_date}} (dalej: „Uczestnik"). Szczegółowe dane Uczestnika wskazane zostały
   w treści Karty Kwalifikacyjnej, stanowiącej załącznik do niniejszej Umowy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 2 – Oświadczenia i zobowiązania Stron

1. Organizator oświadcza, że:
   1.1. posiada stosowną wiedzę i doświadczenie niezbędne do przeprowadzenia Obozu;
   1.2. sprzęt sportowy wykorzystywany podczas Obozu jest sprawny i dopuszczony do użytku;
   1.3. odprowadza regularnie składki na Turystyczny Fundusz Gwarancyjny, zgodnie z przepisami
        Ustawy o imprezach turystycznych i powiązanych usługach turystycznych z dnia 24.11.2017 r.
        (Dz.U. z 2017 r., poz. 2361 ze zm.);
   1.4. w ramach Obozu część oferowanych usług turystycznych organizowana jest w grupach
        liczących od 10 do 15 osób;
   1.5. ze względu na charakter Obozu (obóz sportowy) świadczone usługi, co do zasady,
        nie są dostępne dla osób o ograniczonej sprawności ruchowej.
2. Opiekun oświadcza, że:
   2.1. jest świadom, iż Obóz ma charakter sportowy i wymaga od Uczestnika dobrej sprawności
        fizycznej oraz kondycji, a w związku z powyższym nie zachodzą przeciwwskazania
        (m.in. zdrowotne) dla uczestnictwa Uczestnika w Obozie;
   2.2. przed podpisaniem niniejszej Umowy zarówno on, jak i Uczestnik zapoznali się z Regulaminem
        Obozu, OWU w wyjazdach BiegunSport oraz z innymi załącznikami do niniejszej Umowy,
        akceptują ich postanowienia, a Uczestnik został pouczony o obowiązku ich przestrzegania.
3. Organizator zobowiązuje się do:
   3.1. zapewnienia Uczestnikowi noclegu przez okres trwania Obozu;
   3.2. zapewnienia Uczestnikowi wyżywienia (śniadanie, obiadokolacja) przez okres trwania Obozu;
   3.3. zapewnienia Uczestnikowi bezpiecznych warunków wypoczynku i właściwej opieki wychowawczej,
        w tym w zakresie higieny, zdrowia oraz innych czynności opiekuńczych;
   3.4. zapewnienia Uczestnikowi opieki ze strony stosownej kadry opiekunów;
   3.5. zapewnienia Uczestnikowi opieki medycznej;
   3.6. zapewnienia Uczestnikowi ubezpieczenia od NNW;
   3.7. należytego wykonania wszystkich objętych Umową usług turystycznych;
   3.8. udzielenia pomocy poszkodowanemu Uczestnikowi w czasie trwania Obozu, w tym udzielenia
        informacji dotyczących świadczeń zdrowotnych, władz lokalnych oraz pomocy konsularnej.
4. Opiekun zobowiązuje się do:
   4.1. zapewnienia odpowiedniego wyposażenia sportowego Uczestnika, będącego w dobrym stanie
        technicznym i posiadającego wszelkie wymagane prawem właściwości techniczne;
   4.2. zapewnienia niezbędnej ilości leków lub innych środków medycznych, w razie ich stosowania
        przez Uczestnika;
   4.3. pokrycia szkód powstałych z przyczyn leżących po stronie Uczestnika w trakcie trwania Obozu;
   4.4. uiszczenia Ceny Obozu w wysokości i w sposób określony w § 3 Umowy;
   4.5. dostarczenia i odebrania Uczestnika na i z miejsca zbiórki;
   4.6. niezwłocznego poinformowania Organizatora o wszelkich stwierdzonych przypadkach
        niewykonania lub nienależytego wykonania niniejszej Umowy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 3 – Cena i warunki finansowe

{{payment_schedule}}

Płatności dokonywane są przelewem na rachunek bankowy Organizatora lub gotówką:
  PLN: {{trip_bank_pln}}
  EUR: {{trip_bank_eur}}
  BiegunSport Stepaniak & Biegun sp. j., ul. Grochowa 26C, 30-731 Kraków

W tytule przelewu należy podać imię i nazwisko Uczestnika oraz nazwę Obozu.

Brak dokonania przez Opiekuna którejkolwiek z wpłat w ustalonych terminach uznaje się
za rezygnację z Obozu z przyczyn nieleżących po stronie Organizatora.

Organizator oraz Opiekun mają prawo do odpowiednio podwyższenia i obniżenia Ceny Obozu
na zasadach określonych w „OWU w wyjazdach BiegunSport".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 4 – Postanowienia końcowe

1. Wszelkie zmiany, uzupełnienia lub rozwiązanie niniejszej Umowy wymagają formy pisemnej
   pod rygorem nieważności.
2. Prawem właściwym dla zobowiązań wynikających z niniejszej Umowy jest prawo polskie.
3. Wszelkie użyte w niniejszej Umowie tytuły pełnią wyłącznie funkcję porządkującą
   i pozostają bez wpływu na interpretację jej postanowień.
4. Następujące kwestie uregulowane zostały szczegółowo w treści OWU w wyjazdach BiegunSport,
   stanowiącym załącznik i integralną część niniejszej Umowy:
   a. Obowiązki Uczestnika;
   b. Ochrona zdrowia i życia Uczestnika;
   c. Cena i sposób płatności;
   d. Zmiana Umowy;
   e. Rozwiązanie Umowy oraz przeniesienie praw do uczestnictwa na osobę trzecią;
   f. Odpowiedzialność Organizatora za niewykonanie lub nienależyte wykonanie Umowy;
   g. Reklamacje oraz pozasądowe rozstrzyganie sporów;
   h. Ubezpieczenie;
   i. Przetwarzanie danych osobowych.
5. W sprawach nie uregulowanych Umową lub załącznikami mają zastosowanie przepisy Ustawy
   o usługach turystycznych, Ustawy o systemie oświaty, Kodeksu cywilnego oraz innych
   relewantnych ustaw.
6. Umowa została sporządzona w formie elektronicznej, w języku polskim.
7. W trakcie Obozu osobami do kontaktu w imieniu Organizatora są:
   Karol Biegun        – tel. +48 788 299 500
   Kamil Stepaniak     – tel. +48 603 303 619
8. Bezpośredni kontakt Opiekuna z Uczestnikiem możliwy jest na zasadach określonych
   w Regulaminie Obozu, stanowiącym załącznik do niniejszej Umowy.
9. Integralną część Umowy stanowią następujące załączniki (dostępne na https://biegunsport.pl/o-nas/dokumenty/):
   – Załącznik 1: Karta Kwalifikacyjna
   – Załącznik 2: Regulamin Obozu
   – Załącznik 3: OWU w wyjazdach BiegunSport
   – Załącznik 4: Program Obozu
   – Załącznik 5: Pisemne potwierdzenie posiadania gwarancji ubezpieczeniowej

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AKCEPTACJA UMOWY

Akceptując niniejszą umowę elektronicznie, Opiekun potwierdza, że:
– zapoznał się z pełną treścią Umowy,
– zapoznał się z Ogólnymi Warunkami Uczestnictwa (OWU) i akceptuje ich postanowienia,
– wyraża zgodę na udział Uczestnika w Obozie na warunkach określonych w Umowie,
– wszystkie podane dane są prawdziwe i aktualne.

Organizator: BIEGUNSPORT Stepaniak & Biegun sp. j.
Opiekun: {{parent_name}}
Uczestnik: {{child_name}}

Data wygenerowania umowy: {{today_date}}

BiegunSport Stepaniak & Biegun sp. j. | ul. Grochowa 26C, 30-731 Kraków
biuro@biegunsport.pl | www.biegunsport.pl | tel. +48 603 303 619
`;

// ─────────────────────────────────────────────────────────────────────────────
// OGÓLNE WARUNKI UCZESTNICTWA — osobny dokument, wyświetlany na /parent/owu
// ─────────────────────────────────────────────────────────────────────────────

export const OWU_TEXT = `OGÓLNE WARUNKI UCZESTNICTWA W WYJAZDACH BIEGUNSPORT

Obowiązują od: 1 stycznia 2024
Organizator: BIEGUNSPORT Stepaniak & Biegun sp. j., ul. Grochowa 26C, 30-731 Kraków
NIP: 6772411396 | KRS: 0000651048 | biuro@biegunsport.pl | www.biegunsport.pl

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 1 – Oświadczenia i obowiązki Organizatora

1. Organizator zobowiązuje się do zorganizowania Obozu zgodnie z programem i standardem
   opisanym w Umowie i załącznikach.
2. Organizator zapewnia opiekę wychowawczą i sportową przez cały czas trwania Obozu.
3. Organizator zapewnia ubezpieczenie NNW i OC uczestników na czas trwania Obozu.
4. Organizator zastrzega sobie prawo do dokonywania zmian w programie Obozu z uzasadnionych
   przyczyn (np. warunki atmosferyczne, siła wyższa), informując o tym Opiekuna.
5. Organizator nie ponosi odpowiedzialności za rzeczy wartościowe pozostawione bez nadzoru.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 2 – Oświadczenia i obowiązki Opiekuna

1. Opiekun oświadcza, że stan zdrowia Uczestnika pozwala na udział w Obozie i aktywności
   sportowej.
2. Opiekun zobowiązuje się do poinformowania Organizatora o wszelkich schorzeniach, alergiach
   i przyjmowanych lekach Uczestnika przed rozpoczęciem Obozu (Karta Kwalifikacyjna).
3. Opiekun zobowiązuje się do terminowego regulowania płatności zgodnie z Umową.
4. Opiekun wyraża zgodę na udzielenie Uczestnikowi niezbędnej pomocy medycznej w przypadku
   zagrożenia zdrowia lub życia, jeśli nie będzie możliwe wcześniejsze uzyskanie zgody Opiekuna.
5. Opiekun wyraża zgodę na publikację zdjęć i materiałów filmowych z wizerunkiem Uczestnika
   w celach dokumentacyjnych i promocyjnych BiegunSport (media społecznościowe, strona www).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 3 – Obowiązki Uczestnika

1. Uczestnik zobowiązuje się do przestrzegania Regulaminu Obozu oraz poleceń kadry.
2. Uczestnik zobowiązuje się do poszanowania mienia Organizatora, obiektu i innych uczestników.
3. Uczestnik zobowiązuje się do nieoddalania się od grupy bez zgody opiekuna.
4. Bezwzględnie zakazuje się posiadania i spożywania alkoholu, papierosów i innych używek.
   Złamanie zakazu skutkuje natychmiastowym wydaleniem z Obozu na koszt Opiekuna.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 4 – Ochrona zdrowia i życia Uczestnika

1. W przypadku choroby lub urazu kadra udzieli Uczestnikowi pierwszej pomocy i skontaktuje
   się z Opiekunem.
2. Koszty leczenia wynikające z nieszczęśliwych wypadków pokrywane są z ubezpieczenia NNW.
3. Koszty leczenia chorób przewlekłych lub wynikających z niestosowania się do regulaminu
   ponosi Opiekun.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 5 – Cena i sposób płatności

1. Całkowita cena Obozu ustalona jest w Umowie.
2. Płatności dokonywane są przelewem na rachunek bankowy Organizatora wskazany w Umowie.
3. W tytule przelewu należy podać imię i nazwisko Uczestnika oraz nazwę Obozu.
4. Brak terminowej wpłaty zaliczki traktowany jest jako rezygnacja z Obozu – Umowa ulega
   automatycznemu rozwiązaniu.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 6 – Rezygnacja z Obozu

1. Rezygnacja musi być zgłoszona pisemnie (e-mail: biuro@biegunsport.pl).
2. Warunki zwrotu wpłat:
   a) rezygnacja powyżej 30 dni przed Obozem – zwrot 100% wpłaconej kwoty,
   b) rezygnacja 15–30 dni przed Obozem   – zwrot 50% wpłaconej kwoty,
   c) rezygnacja poniżej 15 dni przed Obozem – brak zwrotu.
3. W przypadku rezygnacji z przyczyn zdrowotnych (zaświadczenie lekarskie) Organizator
   rozpatrzy wniosek o zwrot indywidualnie.
4. Opiekun może przenieść prawo do uczestnictwa w Obozie na inną osobę spełniającą warunki
   uczestnictwa, informując Organizatora z wyprzedzeniem co najmniej 7 dni.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 7 – Odpowiedzialność Organizatora

1. Organizator odpowiada za niewykonanie lub nienależyte wykonanie umowy, chyba że wynikło
   ono z działania siły wyższej, winy Opiekuna/Uczestnika lub osoby trzeciej.
2. W przypadku istotnej zmiany warunków Obozu (cena, termin, miejsce) Opiekun ma prawo
   odstąpić od Umowy bez ponoszenia kosztów.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 8 – Reklamacje

1. Reklamacje należy zgłaszać pisemnie na adres: biuro@biegunsport.pl, w ciągu 30 dni od
   zakończenia Obozu.
2. Organizator rozpatrzy reklamację w ciągu 14 dni od jej otrzymania.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 9 – Ubezpieczenie

1. Organizator zapewnia Uczestnikom ubezpieczenie NNW i OC.
2. Szczegółowy zakres ubezpieczenia dostępny jest na stronie www.biegunsport.pl.
3. Organizator rekomenduje wykupienie przez Opiekuna dodatkowego ubezpieczenia kosztów
   rezygnacji.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§ 10 – Przetwarzanie danych osobowych

1. Administratorem danych osobowych jest BIEGUNSPORT Stepaniak & Biegun sp. j.,
   ul. Grochowa 26C, 30-731 Kraków, e-mail: biuro@biegunsport.pl.
2. Dane przetwarzane są w celu realizacji Umowy (art. 6 ust. 1 lit. b RODO) oraz wypełnienia
   obowiązków prawnych (art. 6 ust. 1 lit. c RODO).
3. Dane nie będą przekazywane podmiotom trzecim, z wyjątkiem firm ubezpieczeniowych
   i przewoźników w zakresie niezbędnym do realizacji Obozu.
4. Opiekun ma prawo dostępu do danych, ich sprostowania, usunięcia oraz wniesienia skargi
   do Prezesa Urzędu Ochrony Danych Osobowych.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BiegunSport Stepaniak & Biegun sp. j. | ul. Grochowa 26C, 30-731 Kraków
biuro@biegunsport.pl | www.biegunsport.pl | tel. +48 603 303 619
`;

// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentTemplateRow {
  payment_type: string;
  installment_number: number | null;
  is_first_installment: boolean;
  category_name: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
}

export interface ContractTemplateData {
  trip_title: string;
  trip_location: string;
  trip_departure: string;
  trip_return: string;
  trip_bank_pln?: string;
  trip_bank_eur?: string;
  child_name: string;
  child_birth_date: string;
  parent_name: string;
  parent_email: string;
  parent_address?: string;
  parent_pesel?: string;
  parent_phone?: string;
  payment_schedule?: string;
  today_date?: string;
}

/**
 * Generuje czytelny blok harmonogramu płatności z szablonów płatności wyjazdu.
 */
export function buildPaymentScheduleText(templates: PaymentTemplateRow[]): string {
  if (!templates || templates.length === 0) {
    return '  Szczegółowy harmonogram płatności zostanie przekazany przez Organizatora.';
  }

  const lines: string[] = [];

  // Najpierw oblicz sumę
  const totalsByCurrency: Record<string, number> = {};
  for (const t of templates) {
    totalsByCurrency[t.currency] = (totalsByCurrency[t.currency] ?? 0) + t.amount;
  }

  for (const t of templates) {
    let label = '';
    if (t.payment_type === 'installment') {
      label = `Rata ${t.installment_number ?? ''}`;
    } else if (t.payment_type === 'season_pass') {
      label = `Karnet${t.category_name ? ` (${t.category_name})` : ''}`;
    } else if (t.payment_type === 'full') {
      label = 'Pełna opłata';
    } else {
      label = t.payment_type;
    }

    const dueStr = t.due_date
      ? format(new Date(t.due_date), 'd MMMM yyyy', { locale: pl })
      : 'termin do uzgodnienia';

    lines.push(
      `  ${label.padEnd(28)} ${String(t.amount.toFixed(0)).padStart(6)} ${t.currency}   termin: ${dueStr}`
    );
  }

  return lines.join('\n');
}

export function fillContractTemplate(
  template: string,
  data: ContractTemplateData
): string {
  const todayStr = data.today_date ?? format(new Date(), 'd MMMM yyyy', { locale: pl });

  return template
    .replace(/\{\{trip_title\}\}/g, data.trip_title)
    .replace(/\{\{trip_location\}\}/g, data.trip_location || '—')
    .replace(/\{\{trip_departure\}\}/g, data.trip_departure)
    .replace(/\{\{trip_return\}\}/g, data.trip_return)
    .replace(/\{\{trip_bank_pln\}\}/g, data.trip_bank_pln || '—')
    .replace(/\{\{trip_bank_eur\}\}/g, data.trip_bank_eur || '—')
    .replace(/\{\{child_name\}\}/g, data.child_name)
    .replace(/\{\{child_birth_date\}\}/g, data.child_birth_date)
    .replace(/\{\{parent_name\}\}/g, data.parent_name)
    .replace(/\{\{parent_email\}\}/g, data.parent_email)
    .replace(/\{\{parent_address\}\}/g, data.parent_address || '—')
    .replace(/\{\{parent_pesel\}\}/g, data.parent_pesel || '—')
    .replace(/\{\{parent_phone\}\}/g, data.parent_phone || '—')
    .replace(/\{\{payment_schedule\}\}/g, data.payment_schedule || '  Brak harmonogramu płatności.')
    .replace(/\{\{today_date\}\}/g, todayStr);
}
