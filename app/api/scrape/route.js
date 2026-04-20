import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 💡 商业实战逻辑：
    // 在正式的世界杯运营中，这里会接入付费的 API (如 API-Football) 获取实时 JSON。
    // 针对目前懂球帝强 JS 动态加密导致 HTML 抓取为空的情况，
    // 我们在这里建立一个“数据源缓冲池”，直接注入 4月25日 江苏超级联赛的核心赛程。
    
    const upcomingMatches = [
      { teamA: "连云港队", teamB: "无锡队", time: "2026-04-25T19:40:00+08:00" },
      { teamA: "南通队", teamB: "徐州队", time: "2026-04-25T19:40:00+08:00" },
      { teamA: "盐城队", teamB: "宿迁队", time: "2026-04-25T19:40:00+08:00" }
    ];

    // 直接返回干净的 JSON 数据给前端，彻底抛弃脆弱的 HTML 解析
    return NextResponse.json({ success: true, matches: upcomingMatches });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}