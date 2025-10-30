import { NextResponse } from 'next/server';
import { kapsoApi } from '@/lib/kapso-api';
import type { AddRecipientsRequest } from '@/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Broadcast ID is required' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as AddRecipientsRequest;

    if (!body.whatsapp_broadcast?.recipients || !Array.isArray(body.whatsapp_broadcast.recipients)) {
      return NextResponse.json(
        { error: 'whatsapp_broadcast.recipients array is required' },
        { status: 400 }
      );
    }

    if (body.whatsapp_broadcast.recipients.length > 1000) {
      return NextResponse.json(
        { error: 'Cannot add more than 1000 recipients per request' },
        { status: 422 }
      );
    }

    const result = await kapsoApi.broadcasts.addRecipients(id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error adding recipients:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add recipients' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Broadcast ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '20', 10);

    const result = await kapsoApi.broadcasts.getRecipients(id, page, perPage);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
