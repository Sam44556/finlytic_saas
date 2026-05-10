import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 TEST ENDPOINT CALLED - If you see this, logging works!');
  console.log('🧪 Current time:', new Date().toISOString());
  
  return NextResponse.json({ 
    message: 'Test endpoint works!',
    timestamp: new Date().toISOString()
  });
}
