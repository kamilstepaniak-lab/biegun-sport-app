import { EmbedFormClient } from './embed-form-client';

interface Props {
  params: Promise<{ key: string }>;
}

// Brak ramki/nawigacji — czysta strona do wstawienia w iframe
export default async function EmbedPage({ params }: Props) {
  const { key } = await params;
  return <EmbedFormClient formKey={key} />;
}
