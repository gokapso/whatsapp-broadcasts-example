import { NextResponse } from 'next/server';
import { kapsoApi } from '@/lib/kapso-api';

export async function GET() {
  try {
    const businessAccountId = process.env.BUSINESS_ACCOUNT_ID;

    if (!businessAccountId) {
      return NextResponse.json(
        { error: 'BUSINESS_ACCOUNT_ID not set in environment variables' },
        { status: 500 }
      );
    }

    const templates = await kapsoApi.templates.list(businessAccountId);

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
