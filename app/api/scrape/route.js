import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 💡 这里我们模拟了未来一周的江苏超级联赛重点赛程
    // 队徽建议：你可以把真实的队徽图片上传到 OSS 或使用懂球帝的 CDN 链接
    const futureMatches = [
      { 
        teamA: "连云港队", teamB: "无锡队", 
        time: "2026-04-25T19:40:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/121.png", // 示例队徽
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/122.png" 
      },
      { 
        teamA: "南通队", teamB: "徐州队", 
        time: "2026-04-25T19:40:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/123.png",
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/124.png"
      },
      { 
        teamA: "盐城队", teamB: "宿迁队", 
        time: "2026-04-26T20:00:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/125.png",
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/126.png"
      },
      { 
        teamA: "泰州队", teamB: "淮安队", 
        time: "2026-04-27T19:30:00+08:00",
        logoA: "https://static1.dongqiudi.com/data/person/600/500/100/127.png",
        logoB: "https://static1.dongqiudi.com/data/person/600/500/100/128.png"
      }
    ];

    return NextResponse.json({ success: true, matches: futureMatches });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}