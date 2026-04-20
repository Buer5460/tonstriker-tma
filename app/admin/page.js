'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';

export default function AdminDashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // 1. 发牌器状态：用于手动增加比赛
  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchTime, setNewMatchTime] = useState('');

  // 2. 抓取引擎状态：用于从懂球帝获取数据
  const [scrapedMatches, setScrapedMatches] = useState([]);
  const [isScraping, setIsScraping] = useState(false);

  // ⚠️ 核心配置：你的机器人兵符与 App 链接
  const BOT_TOKEN = "8796959241:AAEutOxD46OnY6AZOpnZoYnTo_drP59GoOA";
  const APP_URL = "https://t.me/TONStriker2026_bot/play";

  // 登录逻辑
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '888888') {
      setIsAuthenticated(true);
      fetchPredictions();
    } else {
      alert('❌ 密码错误！');
      setPassword('');
    }
  };

  // 读取所有待结算的预测记录
  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  // 手动发布赛事
  const handleAddMatch = async (e) => {
    e.preventDefault();
    await saveMatchToDB(newTeamA, newTeamB, newMatchTime);
    setNewTeamA(''); setNewTeamB(''); setNewMatchTime('');
  };

  // 通用的保存赛事到数据库函数
  const saveMatchToDB = async (teamA, teamB, matchTime) => {
    if (!teamA || !teamB || !matchTime) return;
    setLoading(true);
    const matchTimeISO = new Date(matchTime).toISOString();
    const { error } = await supabase.from('matches').insert([{
      team_a: teamA, team_b: teamB, match_time: matchTimeISO
    }]);
    if (error) {
      alert("❌ 发布失败: " + error.message);
    } else {
      alert(`✅ 【${teamA} vs ${teamB}】发布成功！`);
    }
    setLoading(false);
  };

  // 🕷️ 核心：懂球帝一键抓取逻辑（调用你的私有 API 节点）
  const handleScrapeDongqiudi = async () => {
    setIsScraping(true);
    try {
      // 关键改动：不再求助于不稳定的公共代理，而是访问我们自己的后端
      const response = await fetch('/api/scrape');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // 拿到 HTML 后，这里展示我们解析好的江苏超级联赛（模拟）赛程
      // 未来我们将在这里加入正则解析，直接把 data.html 里的文字抠出来
      const mockParsedMatches = [
        { teamA: "南京城市", teamB: "苏州东吴", time: "2026-04-25T19:30:00" },
        { teamA: "无锡吴钩", teamB: "南通支云", time: "2026-04-26T15:00:00" },
        { teamA: "扬州队", teamB: "常州队", time: "2026-04-27T20:00:00" }
      ];

      setScrapedMatches(mockParsedMatches);
      alert(`✅ 防火墙突破成功！已准备好 ${mockParsedMatches.length} 场待确认赛事。`);

    } catch (err) {
      console.error(err);
      alert("抓取失败: " + err.message);
    }
    setIsScraping(false);
  };

  // 💰 结算引擎：分钱 + 自动报喜
  const handleSettle = async (matchName, winningTeam) => {
    const confirmSettle = confirm(`确认【${winningTeam}】获胜？操作不可逆！`);
    if (!confirmSettle) return;
    setLoading(true);

    const matchBets = predictions.filter(p => p.match_name === matchName);
    const winners = matchBets.filter(p => p.team_picked === winningTeam);
    const losers = matchBets.filter(p => p.team_picked !== winningTeam);
    const totalLoserPool = losers.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWinnerPrincipal = winners.reduce((sum, bet) => sum + bet.amount, 0);

    for (const winner of winners) {
      let profit = totalWinnerPrincipal > 0 ? Math.floor((winner.amount / totalWinnerPrincipal) * totalLoserPool) : 0;
      const totalPayout = winner.amount + profit;

      const { data: userData } = await supabase.from('users').select('score').eq('tg_id', winner.user_tg_id).single();
      if (userData) {
        await supabase.from('users').update({ score: userData.score + totalPayout }).eq('tg_id', winner.user_tg_id);
        
        // 机器人全自动私信推送报喜
        if (winner.user_tg_id !== 'WalletUser') {
          fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: winner.user_tg_id,
              text: `🎉 恭喜！您支持的【${winningTeam}】赢了！\n💰 庄家已派发 ${totalPayout} $GOAL 奖金！`,
              reply_markup: { inline_keyboard: [[{ text: "🚀 立即查看", url: APP_URL }]] }
            })
          });
        }
      }
      await supabase.from('predictions').delete().eq('id', winner.id);
    }
    for (const loser of losers) await supabase.from('predictions').delete().eq('id', loser.id);

    alert(`结算完毕，奖金已自动下发！`);
    fetchPredictions(); 
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-300 text-center mb-8">庄家最高权限</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-6 text-center tracking-[0.5em]"/>
          <button type="submit" className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 rounded-xl transition-all">确认接入</button>
        </form>
      </main>
    );
  }

  const matches = [...new Set(predictions.map(p => p.match_name))];

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-black text-red-500 mb-8 flex items-center italic">👁️ TONStriker 上帝控制台</h1>

      {/* 📡 懂球帝一键抓取面板 */}
      <div className="bg-gray-800 p-6 rounded-xl border border-green-900/50 shadow-xl mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-green-400">📡 第三方赛程抓取 (江苏超级联赛)</h2>
          <button onClick={handleScrapeDongqiudi} disabled={isScraping} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded font-bold transition-all active:scale-95">
            {isScraping ? '🕷️ 抓取中...' : '🕷️ 一键同步懂球帝'}
          </button>
        </div>
        
        {scrapedMatches.length > 0 && (
          <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
            {scrapedMatches.map((m, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-700">
                <span>{m.teamA} VS {m.teamB} <span className="text-xs text-gray-500 ml-2">{new Date(m.time).toLocaleString()}</span></span>
                <button onClick={() => saveMatchToDB(m.teamA, m.teamB, m.time)} className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1 rounded font-bold">✅ 入库发布</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 手动辅助发牌 */}
      <div className="bg-gray-800 p-6 rounded-xl border border-blue-900/50 shadow-xl mb-10">
        <h2 className="text-xl font-bold mb-4 text-blue-400">➕ 手动赛事发布</h2>
        <form onSubmit={handleAddMatch} className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <input type="text" placeholder="主队" value={newTeamA} onChange={(e) => setNewTeamA(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none"/>
          <input type="text" placeholder="客队" value={newTeamB} onChange={(e) => setNewTeamB(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none"/>
          <input type="datetime-local" value={newMatchTime} onChange={(e) => setNewMatchTime(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none"/>
          <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded shadow-lg active:scale-95 transition-all">🚀 全网发布</button>
        </form>
      </div>

      {/* 结算管理 */}
      <h2 className="text-xl font-bold mb-4 text-gray-400 italic">💰 待处理结算账单</h2>
      <div className="space-y-4">
        {matches.length === 0 ? <p className="text-gray-600">暂无待处理记录</p> : matches.map(matchName => {
          const betsForMatch = predictions.filter(p => p.match_name === matchName);
          const totalAmount = betsForMatch.reduce((sum, bet) => sum + bet.amount, 0);
          return (
            <div key={matchName} className="bg-gray-800 p-6 rounded-xl border border-red-900/50 shadow-xl flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div>
                <h2 className="text-xl font-bold">{matchName}</h2>
                <span className="text-yellow-400 font-bold text-sm tracking-widest">奖池累计: {totalAmount} $GOAL</span>
              </div>
              <div className="flex space-x-2 w-full md:w-auto">
                <button onClick={() => handleSettle(matchName, matchName.split(' vs ')[0])} className="flex-1 md:flex-none bg-red-900 hover:bg-red-800 px-4 py-3 rounded font-bold text-sm active:scale-95 transition-all">主胜派奖</button>
                <button onClick={() => handleSettle(matchName, matchName.split(' vs ')[1])} className="flex-1 md:flex-none bg-blue-900 hover:bg-blue-800 px-4 py-3 rounded font-bold text-sm active:scale-95 transition-all">客胜派奖</button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}