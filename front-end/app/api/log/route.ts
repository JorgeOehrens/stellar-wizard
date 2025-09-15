import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { stage, error, planId } = await request.json();

    // Log the error (in production, you might want to use a proper logging service)
    console.error(`[NFT Wizard Error] Stage: ${stage}, Plan ID: ${planId}, Error: ${error}`);

    // You could also send this to an external monitoring service like Sentry, DataDog, etc.
    // Example:
    // await sendToMonitoringService({ stage, error, planId, timestamp: new Date() });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logging API error:', error);
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    );
  }
}