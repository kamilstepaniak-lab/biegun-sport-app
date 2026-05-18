import path from 'path';
import React from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Font z obsługą polskich znaków — wbudowane fonty react-pdf (Helvetica)
// nie renderują ł, ą, ę itd. poprawnie.
const fontsDir = path.join(process.cwd(), 'public', 'fonts');
Font.register({
  family: 'DejaVu',
  fonts: [
    { src: path.join(fontsDir, 'DejaVuSans.ttf') },
    { src: path.join(fontsDir, 'DejaVuSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const PURPLE = '#6d28d9';
const PURPLE_DARK = '#5b21b6';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#111827',
    lineHeight: 1.5,
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 0,
  },
  header: {
    backgroundColor: PURPLE,
    color: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerBrand: {
    fontSize: 7,
    letterSpacing: 1,
    color: '#ddd6fe',
    marginBottom: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  headerNumLabel: { fontSize: 7, color: '#c4b5fd', textAlign: 'right' },
  headerNum: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  section: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: PURPLE_DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  line: { marginBottom: 2 },
  kvRow: { flexDirection: 'row', marginBottom: 2 },
  kvKey: { color: '#6b7280', width: 160 },
  kvVal: { fontWeight: 'bold', flex: 1 },
  numRow: { flexDirection: 'row', marginBottom: 2 },
  numMark: { color: '#6b7280', width: 26 },
  numText: { flex: 1 },
  signBlock: {
    marginTop: 4,
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderTopWidth: 1.5,
    borderTopColor: '#86efac',
  },
  signTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
  },
});

function parseLine(line: string, idx: number): React.ReactNode {
  const t = line.trim();
  if (!t) return <View key={idx} style={{ height: 4 }} />;

  // Numerowane / literowe / podpunkty / myślniki
  const numMatch = t.match(/^(\d+\.\d+\.?|\d+\.|[a-z]\.)\s+(.*)$/);
  if (numMatch) {
    return (
      <View key={idx} style={styles.numRow}>
        <Text style={styles.numMark}>{numMatch[1]}</Text>
        <Text style={styles.numText}>{numMatch[2]}</Text>
      </View>
    );
  }
  if (/^[–—-]\s+/.test(t)) {
    return (
      <View key={idx} style={styles.numRow}>
        <Text style={styles.numMark}>—</Text>
        <Text style={styles.numText}>{t.replace(/^[–—-]\s+/, '')}</Text>
      </View>
    );
  }

  // Klucz: wartość
  const colonIdx = t.indexOf(':');
  if (colonIdx > 0 && colonIdx < 40) {
    return (
      <View key={idx} style={styles.kvRow}>
        <Text style={styles.kvKey}>{t.slice(0, colonIdx + 1)}</Text>
        <Text style={styles.kvVal}>{t.slice(colonIdx + 1).trim() || '—'}</Text>
      </View>
    );
  }

  return (
    <Text key={idx} style={styles.line}>
      {t}
    </Text>
  );
}

function ContractSection({ text }: { text: string }) {
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const isHeader =
    /^§\s*\d+/.test(firstLine) ||
    firstLine === 'AKCEPTACJA UMOWY' ||
    firstLine === 'SZCZEGÓŁY OBOZU';

  if (isHeader) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{firstLine}</Text>
        {lines.slice(1).map((l, i) => parseLine(l, i))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {lines.map((l, i) => parseLine(l, i))}
    </View>
  );
}

export interface ContractPdfProps {
  contractText: string;
  contractNumber: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

export function ContractPdf({
  contractText,
  contractNumber,
  acceptedAt,
  acceptedByName,
}: ContractPdfProps) {
  const sections = contractText
    .split(/━+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Document title={`Umowa ${contractNumber ?? ''} — BiegunSport`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.headerBrand}>BIEGUNSPORT</Text>
            <Text style={styles.headerTitle}>Umowa uczestnictwa</Text>
          </View>
          {contractNumber ? (
            <View>
              <Text style={styles.headerNumLabel}>NUMER UMOWY</Text>
              <Text style={styles.headerNum}>{contractNumber}</Text>
            </View>
          ) : null}
        </View>

        {sections.map((s, i) => (
          <ContractSection key={i} text={s} />
        ))}

        {acceptedAt ? (
          <View style={styles.signBlock} wrap={false}>
            <Text style={styles.signTitle}>Podpis elektroniczny</Text>
            {acceptedByName ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Opiekun:</Text>
                <Text style={styles.kvVal}>{acceptedByName}</Text>
              </View>
            ) : null}
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Data akceptacji:</Text>
              <Text style={styles.kvVal}>
                {format(new Date(acceptedAt), 'd MMMM yyyy, HH:mm', { locale: pl })}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Forma:</Text>
              <Text style={styles.kvVal}>
                Elektroniczna — akceptacja przez konto BiegunSport
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          BIEGUNSPORT Stepaniak &amp; Biegun sp. j. · ul. Grochowa 26C, 30-731 Kraków ·
          biuro@biegunsport.pl · www.biegunsport.pl
        </Text>
      </Page>
    </Document>
  );
}
