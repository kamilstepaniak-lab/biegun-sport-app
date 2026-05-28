import { NextRequest, NextResponse } from 'next/server';

import { EMAIL_QUEUE_BATCH_SIZE, processEmailQueueBatch } from '@/lib/email-queue';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processEmailQueueBatch(EMAIL_QUEUE_BATCH_SIZE);
    console.log('Cron email-queue:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Cron email-queue error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

