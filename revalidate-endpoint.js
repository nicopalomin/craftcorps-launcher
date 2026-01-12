import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const secret = process.env.REVALIDATION_TOKEN;

        if (!secret) {
            return NextResponse.json(
                { message: 'REVALIDATION_TOKEN not configured' },
                { status: 500 }
            );
        }

        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json(
                { message: 'Invalid token' },
                { status: 401 }
            );
        }

        revalidateTag('latest-version');

        return NextResponse.json({ revalidated: true, now: Date.now() });
    } catch (err) {
        return NextResponse.json(
            { message: 'Error revalidating' },
            { status: 500 }
        );
    }
}
