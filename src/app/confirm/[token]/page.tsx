import { ConfirmTokenClient } from './confirm-client';

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string }>;
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { action } = await searchParams;

  return <ConfirmTokenClient token={token} actionOverride={action} />;
}
