import { NextRequest, NextResponse } from 'next/server'

// This endpoint doesn't exist - redirect to proper API endpoint
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'This endpoint does not exist. Use POST /api/programs to create programs.',
    correctEndpoint: '/api/programs',
    method: 'POST'
  }, { status: 400 })
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'This endpoint does not exist. Use POST /api/programs to create programs.',
    correctEndpoint: '/api/programs',
    method: 'POST'
  }, { status: 400 })
}
