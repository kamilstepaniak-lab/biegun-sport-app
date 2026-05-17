import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polityka Prywatności — BiegunSport',
  description: 'Informacja o przetwarzaniu danych osobowych w serwisie BiegunSport.',
};

export default function PolitykaPrywatnosciPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fb] py-8 px-4 safe-bottom">
      <article className="mx-auto max-w-3xl bg-white rounded-2xl ring-1 ring-gray-100 p-6 sm:p-10">
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do rejestracji
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Polityka Prywatności biegunsport.pl</h1>

        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          Niniejsza Polityka prywatności ma na celu przekazanie Ci informacji na temat tego, w jaki
          sposób przetwarzane są Twoje dane osobowe podczas Twoich wizyt na naszej stronie
          internetowej, jak również gdy kontaktujesz się z naszą firmą lub korzystasz z naszych
          usług. Służy ona przekazaniu Ci informacji, o których mowa w art. 13 rozporządzenia
          Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. („RODO”).
          Polityka prywatności ma charakter informacyjny i nie wynikają z jej treści dla Ciebie
          żadne obowiązki (nie jest regulaminem, czy umową).
        </p>

        <Section title="Kto jest administratorem Twoich danych osobowych?">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Administratorem Twoich danych osobowych jest BiegunSport – Stepaniak &amp; Biegun
              Sp. J., ul. Grochowa 26C, 30-731 Kraków.
            </li>
            <li>
              We wszelkich kwestiach dotyczących ochrony danych osobowych możesz się skontaktować
              z nami mailowo na adres:{' '}
              <a href="mailto:biuro@biegunsport.pl" className="text-blue-600 hover:underline">
                biuro@biegunsport.pl
              </a>
              , listownie na adres: ul. Grochowa 26C, 30-731 Kraków.
            </li>
          </ul>
        </Section>

        <Section title="Jak dbamy o bezpieczeństwo Twoich danych osobowych?">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Twoje dane osobowe przetwarzane są zgodnie z RODO oraz innymi aktualnie
              obowiązującymi przepisami prawa o ochronie danych osobowych.
            </li>
            <li>
              Stosujemy wymagane przez przepisy prawa krajowego oraz unijnego środki techniczne
              i organizacyjne zapewniające ochronę przetwarzanych danych osobowych i zabezpieczenie
              danych przed ich udostępnieniem osobom nieupoważnionym, przejęciem przez osoby
              nieuprawnione, przetwarzaniem z naruszeniem przepisów oraz zmianą, utratą lub
              zniszczeniem.
            </li>
            <li>
              Podanie danych osobowych jest dobrowolne, ale konieczne dla korzystania
              z wymagających tego funkcjonalności strony internetowej, jak również dla zawarcia
              umowy związanej ze skorzystaniem z naszych usług i wystawienia dokumentów księgowych.
            </li>
            <li>
              W sytuacji, gdy podstawą przetwarzania danych osobowych jest zgoda, jej brak
              uniemożliwi nam podjęcie działania, którego ta zgoda dotyczy. Wyrażoną zgodę możesz
              cofnąć w każdej chwili, jednakże nie będzie to miało wpływu na zgodność z prawem
              przetwarzania dokonanego na podstawie zgody przed jej cofnięciem.
            </li>
          </ul>
        </Section>

        <Section title="W jakim celu i na jakiej podstawie przetwarzamy Twoje dane osobowe?">
          <p className="mb-3">
            Twoje dane osobowe przetwarzamy w szczególności w celu świadczenia oferowanych przez
            nas usług i wykonywania zawartych umów, jak również podjęcia działań przed ich
            zawarciem oraz w celu świadczenia usług drogą elektroniczną w związku z korzystaniem
            ze strony internetowej.
          </p>
          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Świadczenie usług</h3>
          <p>
            Dane podane w związku z korzystaniem z usług (imię i nazwisko, adres, adres e-mail,
            numer telefonu, a w przypadku przedsiębiorców również nazwa i adres firmy oraz NIP)
            przetwarzamy w celu: realizacji usługi i wykonania umowy (art. 6 ust. 1 lit. b RODO);
            ustalenia, dochodzenia lub obrony przed roszczeniami oraz w celach archiwalnych
            (art. 6 ust. 1 lit. f RODO); wystawienia i przechowywania dokumentów księgowych oraz
            rozpatrywania reklamacji (art. 6 ust. 1 lit. c RODO).
          </p>
          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Usługi świadczone drogą elektroniczną</h3>
          <p>
            Dane zebrane w związku z korzystaniem ze strony (m.in. adres IP, adres URL żądania,
            identyfikator urządzenia, typ przeglądarki, data i godzina korzystania) przetwarzamy
            w celu świadczenia usług drogą elektroniczną (art. 6 ust. 1 lit. b RODO) oraz
            ustalenia, dochodzenia lub obrony przed roszczeniami (art. 6 ust. 1 lit. f RODO).
          </p>
          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Marketing i analityka</h3>
          <p>
            Dane przetwarzamy w celu marketingu naszych usług (art. 6 ust. 1 lit. f RODO),
            z zastrzeżeniem, że marketing bezpośredni za pomocą urządzeń końcowych wymaga Twojej
            uprzedniej zgody (art. 6 ust. 1 lit. a RODO), a także w celu tworzenia zestawień,
            analiz i statystyk.
          </p>
          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Kontakt mailowy lub telefoniczny</h3>
          <p>
            Dane podane w związku z kontaktem przetwarzamy w celu udzielenia odpowiedzi
            (art. 6 ust. 1 lit. f RODO), podjęcia działań przed zawarciem umowy
            (art. 6 ust. 1 lit. b RODO) oraz obrony przed roszczeniami (art. 6 ust. 1 lit. f RODO).
          </p>
          <p className="mt-3">
            Dane przetwarzamy przez okres wykonywania umowy / świadczenia usług, chyba że dalsze
            przechowywanie wynika z przepisów prawa (podatkowych, rachunkowych) lub jest
            uzasadnione terminem przedawnienia roszczeń. W każdym przypadku decyduje dłuższy
            termin przechowywania danych.
          </p>
        </Section>

        <Section title="Pliki cookies">
          <p>
            Serwis internetowy używa technologii plików cookies. Pliki cookies zapisywane są na
            urządzeniu końcowym osoby odwiedzającej Serwis i służą zapewnieniu prawidłowego
            działania Serwisu, a w zależności od wyrażonej zgody — również tworzeniu statystyk
            oraz celom marketingowym. Każda osoba odwiedzająca może wyrazić lub wycofać zgodę
            w ramach banneru cookies wyświetlanego podczas pierwszej wizyty. Serwis korzysta
            z narzędzi dostawców zewnętrznych (m.in. Google Ireland Limited, CookieYes).
          </p>
        </Section>

        <Section title="Jakie masz prawa?">
          <p className="mb-2">
            W związku z przetwarzaniem Twoich danych osobowych przysługuje Ci uprawnienie do:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              dostępu do Twoich danych osobowych oraz żądania ich sprostowania, usunięcia
              i ograniczenia przetwarzania; w zakresie, w jakim podstawą przetwarzania jest nasz
              prawnie uzasadniony interes — wniesienia sprzeciwu;
            </li>
            <li>
              wycofania zgody w zakresie, w jakim podstawą przetwarzania jest zgoda (bez wpływu na
              zgodność z prawem przetwarzania dokonanego przed wycofaniem);
            </li>
            <li>
              przenoszenia danych — otrzymania od nas Twoich danych w ustrukturyzowanym,
              powszechnie stosowanym formacie;
            </li>
            <li>
              wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2,
              00-193 Warszawa), gdy uznasz, że przetwarzanie narusza Twoje prawa.
            </li>
          </ul>
        </Section>

        <Section title="Komu udostępniamy Twoje dane osobowe?">
          <p>
            Twoje dane osobowe mogą być przekazywane podmiotom uprawnionym na podstawie przepisów
            prawa, a także podmiotom, którym powierzamy dane na podstawie umów: dostawcom usług
            hostingowych, marketingowych i systemów IT, dostawcom oprogramowania do wystawiania
            dokumentów księgowych oraz biuru rachunkowemu. Niektóre podmioty mogą przechowywać
            dane poza Europejskim Obszarem Gospodarczym — wyłącznie do państw zapewniających
            adekwatny stopień ochrony lub przy zapewnieniu odpowiednich zabezpieczeń (m.in.
            standardowych klauzul umownych przyjętych przez Komisję Europejską).
          </p>
        </Section>

        <p className="mt-8 text-xs text-gray-400">
          Administrator danych: BiegunSport – Stepaniak &amp; Biegun Sp. J., KRS 0000651048,
          NIP 6772411396, REGON 366035549. Kontakt: biuro@biegunsport.pl, tel. +48 788 299 500 /
          +48 603 303 619.
        </p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}
