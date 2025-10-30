import { NextResponse } from 'next/server';
import { kapsoApi } from '@/lib/kapso-api';
import type { CreateBroadcastRequest } from '@/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBroadcastRequest;

    if (!body.whatsapp_broadcast) {
      return NextResponse.json(
        { error: 'Missing required field: whatsapp_broadcast' },
        { status: 400 }
      );
    }

    const { name, phone_number_id, whatsapp_template_id } = body.whatsapp_broadcast;

    if (!name || !phone_number_id || !whatsapp_template_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone_number_id, whatsapp_template_id' },
        { status: 400 }
      );
    }

    const result = await kapsoApi.broadcasts.create(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create broadcast' },
      { status: 500 }
    );
  }
}
