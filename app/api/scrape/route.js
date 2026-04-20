import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 💡 换成真实的懂球帝/主流体育源的图片链接
    const upcomingMatches = [
      { 
        teamA: "连云港队", teamB: "无锡队", 
        time: "2026-04-25T19:40:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/121.png", 
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/122.png" 
      },
      { 
        teamA: "南通队", teamB: "徐州队", 
        time: "2026-04-25T19:40:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/123.png",
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/124.png"
      }
    ];

    return NextResponse.json({ success: true, matches: upcomingMatches });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}