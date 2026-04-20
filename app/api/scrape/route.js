import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 伪装成真实的 iPhone 手机浏览器去请求
    const response = await fetch('https://m.dongqiudi.com/match/112', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `懂球帝拒绝访问，状态码: ${response.status}` }, { status: 500 });
    }

    // 成功拿回懂球帝的原始 HTML 代码
    const html = await response.text();
    return NextResponse.json({ html: html });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}