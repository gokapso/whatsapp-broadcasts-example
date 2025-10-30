import { NextResponse } from 'next/server';
import { whatsappClient, phoneNumberId } from '@/lib/whatsapp';
import { buildKapsoFields } from '@kapso/whatsapp-cloud-api';
import type { MessageStats } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');

    // Default to messages from today
    const since = sinceParam || new Date().toISOString().split('T')[0] + 'T00:00:00Z';

    const history = await whatsappClient.messages.query({
      phoneNumberId,
      direction: 'outbound',
      since,
      limit: 100,
      fields: buildKapsoFields(['status']),
    });

    const stats: MessageStats = {
      totalSent: history.data.length,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
    };

    history.data.forEach((msg) => {
      const status = msg.kapso?.status;
      if (status === 'delivered') {
        stats.delivered++;
      } else if (status === 'read') {
        stats.read++;
      } else if (status === 'failed') {
        stats.failed++;
      } else {
        stats.pending++;
      }
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
