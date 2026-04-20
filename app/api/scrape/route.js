import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const upcomingMatches = [
      { 
        teamA: "连云港队", teamB: "无锡队", 
        time: "2026-04-25T19:40:00+08:00",
        // 替换为开源无防盗链的动态队徽
        logoA: "https://ui-avatars.com/api/?name=连&background=1e293b&color=fbbf24&rounded=true&size=128&font-size=0.4", 
        logoB: "https://ui-avatars.com/api/?name=无&background=b91c1c&color=ffffff&rounded=true&size=128&font-size=0.4" 
      },
      { 
        teamA: "南通队", teamB: "徐州队", 
        time: "2026-04-25T19:40:00+08:00",
        logoA: "https://ui-avatars.com/api/?name=南&background=047857&color=ffffff&rounded=true&size=128&font-size=0.4",
        logoB: "https://ui-avatars.com/api/?name=徐&background=ca8a04&color=ffffff&rounded=true&size=128&font-size=0.4"
      }
    ];

    return NextResponse.json({ success: true, matches: upcomingMatches });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}