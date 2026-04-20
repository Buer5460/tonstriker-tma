'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';

export default function AdminDashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchTime, setNewMatchTime] = useState('');

  const [scrapedMatches, setScrapedMatches] = useState([]);
  const [isScraping, setIsScraping] = useState(false);

  // ⚠️ 提现记录状态
  const [withdrawals, setWithdrawals] = useState([]);

  const BOT_TOKEN = "8796959241:AAEutOxD46OnY6AZOpnZoYnTo_drP59GoOA";
  const APP_URL = "https://t.me/TONStriker2026_bot/play";

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '888888') {
      setIsAuthenticated(true);
      fetchPredictions();
      fetchWithdrawals(); // 登录时顺便拉取提现列表
    } else {
      alert('❌ 密码错误！');
      setPassword('');
    }
  };

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  // 获取所有提现申请
  const fetchWithdrawals = async () => {
    const { data } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (data) setWithdrawals(data);
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    await saveMatchToDB(newTeamA, newTeamB, newMatchTime, "", "");
    setNewTeamA(''); setNewTeamB(''); setNewMatchTime('');
  };

  const saveMatchToDB = async (teamA, teamB, matchTime, logoA, logoB) => {
    if (!teamA || !teamB || !matchTime) return;
    setLoading(true);
    const matchTimeISO = new Date(matchTime).toISOString();
    const { error } = await supabase.from('matches').insert([{
      team_a: teamA, team_b: teamB, match_time: matchTimeISO,
      team_a_logo: logoA || "", team_b_logo: logoB || ""
    }]);
    if (error) alert("❌ 发布失败: " + error.message);
    else alert(`✅ 【${teamA} vs ${teamB}】已发布到玩家大厅！`);
    setLoading(false);
  };

  const handleScrapeDongqiudi = async () => {
    setIsScraping(true);
    try {
      const response = await fetch('/api/scrape');
      const data = await response.json();
      if (!data.success) throw new Error("数据节点无响应");

      if (data.matches && data.matches.length > 0) {
        setScrapedMatches(data.matches);
        alert(`✅ 数据同步成功！已获取 ${data.matches.length} 场预售赛程。`);
      } else {
        alert("⚠️ 节点已连通，但未发现新赛程。");
      }
    } catch (err) { alert("同步失败: " + err.message); }
    setIsScraping(false);
  };

  // 💰 核心商业升级：10% 抽水 + 比例分红
  const handleSettle = async (matchName, winningTeam) => {
    const confirmSettle = confirm(`确认【${winningTeam}】获胜？全网结算开始，操作不可逆！`);
    if (!confirmSettle) return;
    setLoading(true);

    const matchBets = predictions.filter(p => p.match_name === matchName);
    const winners = matchBets.filter(p => p.team_picked === winningTeam);
    const losers = matchBets.filter(p => p.team_picked !== winningTeam);
    
    // 计算输家总池和赢家总本金
    const totalLoserPool = losers.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWinnerPrincipal = winners.reduce((sum, bet) => sum + bet.amount, 0);

    // 🏆 平台抽水逻辑：收取输家总池 10% 的服务费
    const platformFee = Math.floor(totalLoserPool * 0.1);
    // 剩下的 90% 用于分配给赢家
    const distributablePool = totalLoserPool - platformFee;

    let logs = `📊 结算报告：\n总奖池: ${totalLoserPool}\n平台服务费(10%): ${platformFee}\n分红池: ${distributablePool}\n\n`;

    for (const winner of winners) {
      // 按照投入本金的比例，瓜分剩下的分红池
      let profit = totalWinnerPrincipal > 0 ? Math.floor((winner.amount / totalWinnerPrincipal) * distributablePool) : 0;
      const totalPayout = winner.amount + profit;

      const { data: userData } = await supabase.from('users').select('score').eq('tg_id', winner.user_tg_id).single();
      if (userData) {
        await supabase.from('users').update({ score: userData.score + totalPayout }).eq('tg_id', winner.user_tg_id);
        
        if (winner.user_tg_id !== 'WalletUser') {
          fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: winner.user_tg_id,
              text: `🎉 恭喜！您支持的【${winningTeam}】赢了！\n💰 平台已扣除 10% 服务费，为您派发 ${totalPayout} $GOAL 奖金！`,
              reply_markup: { inline_keyboard: [[{ text: "🚀 立即查看", url: APP_URL }]] }
            })
          });
        }
      }
      await supabase.from('predictions').delete().eq('id', winner.id);
    }
    for (const loser of losers) await supabase.from('predictions').delete().eq('id', loser.id);

    alert(logs + "✅ 结算完毕，奖金已下发，平台抽水已留存！");
    fetchPredictions(); 
    setLoading(false);
  };

  // 处理提现请求（标记为已打款）
  const handleCompleteWithdrawal = async (id) => {
    if (!confirm("确认您已在链上完成转账？点击确认将更改订单状态。")) return;
    await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', id);
    fetchWithdrawals();
    alert("✅ 订单状态已更新为：已打款！");
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700">
          <h1 className="text-2xl font-black text-white text-center mb-8">庄家上帝视角</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-4 text-white mb-6 text-center tracking-[0.5em]"/>
          <button type="submit" className="w-full bg-red-800 hover:bg-red-700 text-white font-black py-4 rounded-xl">确认接入</button>
        </form>
      </main>
    );
  }

  const matches = [...new Set(predictions.map(p => p.match_name))];

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-black text-red-500 mb-8 italic">👁️ TONStriker 上帝控制台</h1>

      <div className="bg-gray-800 p-6 rounded-xl border border-green-900/50 shadow-xl mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-green-400">📡 第三方赛程抓取</h2>
          <button onClick={handleScrapeDongqiudi} disabled={isScraping} className="bg-green-700 hover:bg-green-600 px-6 py-3 rounded-lg font-black text-white">
            {isScraping ? '🕷️ 抓取引擎运转中...' : '🕷️ 一键同步最新赛程'}
          </button>
        </div>
        {scrapedMatches.length > 0 && (
          <div className="mt-6 border-t border-gray-700 pt-6 space-y-3">
            {scrapedMatches.map((m, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center space-x-4">
                  {m.logoA && <img src={m.logoA} className="w-8 h-8 object-contain" alt="logo" />}
                  <span className="font-bold text-lg">{m.teamA} <span className="text-yellow-500 mx-2">VS</span> {m.teamB}</span>
                  {m.logoB && <img src={m.logoB} className="w-8 h-8 object-contain" alt="logo" />}
                  <span className="text-xs text-gray-500 ml-4">{new Date(m.time).toLocaleString()}</span>
                </div>
                <button onClick={() => saveMatchToDB(m.teamA, m.teamB, m.time, m.logoA, m.logoB)} className="bg-blue-600 hover:bg-blue-500 text-sm px-5 py-2 rounded font-bold">✅ 入库发布</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-blue-900/50 shadow-xl mb-10">
        <h2 className="text-xl font-bold mb-4 text-blue-400">➕ 手动赛事发布</h2>
        <form onSubmit={handleAddMatch} className="flex space-x-4">
          <input type="text" placeholder="主队" value={newTeamA} onChange={(e) => setNewTeamA(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white"/>
          <input type="text" placeholder="客队" value={newTeamB} onChange={(e) => setNewTeamB(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white"/>
          <input type="datetime-local" value={newMatchTime} onChange={(e) => setNewMatchTime(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white"/>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white font-bold py-3 px-6 rounded">发布</button>
        </form>
      </div>

      <h2 className="text-2xl font-black mb-6 text-gray-400 italic">💰 待处理结算账单 (10% 抽水制)</h2>
      <div className="space-y-4 mb-10">
        {matches.map(matchName => {
          const betsForMatch = predictions.filter(p => p.match_name === matchName);
          const totalAmount = betsForMatch.reduce((sum, bet) => sum + bet.amount, 0);
          return (
            <div key={matchName} className="bg-gray-800 p-6 rounded-xl border border-red-900/50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{matchName}</h2>
                <span className="text-yellow-400 font-bold text-sm bg-yellow-400/10 px-3 py-1 rounded inline-block mt-2">输赢总池: {totalAmount} $GOAL</span>
              </div>
              <div className="flex space-x-3">
                <button onClick={() => handleSettle(matchName, matchName.split(' vs ')[0])} className="bg-red-900 hover:bg-red-800 px-6 py-3 rounded-lg font-black text-sm">主胜结算</button>
                <button onClick={() => handleSettle(matchName, matchName.split(' vs ')[1])} className="bg-blue-900 hover:bg-blue-800 px-6 py-3 rounded-lg font-black text-sm">客胜结算</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 新增：玩家提现请求列表 */}
      <h2 className="text-2xl font-black mb-6 text-amber-400 italic">🏦 玩家提现审批大厅</h2>
      <div className="bg-gray-800 rounded-xl border border-amber-900/50 overflow-hidden">
        {withdrawals.length === 0 ? <p className="p-6 text-gray-500 text-center">暂无玩家发起提现请求。</p> : (
          <table className="w-full text-left">
            <thead className="bg-gray-900 text-gray-400 border-b border-gray-700">
              <tr>
                <th className="p-4 font-medium">发起时间</th>
                <th className="p-4 font-medium">TG 用户 ID</th>
                <th className="p-4 font-medium">提现积分 ($GOAL)</th>
                <th className="p-4 font-medium">TON 钱包地址</th>
                <th className="p-4 font-medium">状态 / 操作</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => (
                <tr key={w.id} className="border-b border-gray-700/50 hover:bg-gray-800/80">
                  <td className="p-4 text-sm text-gray-400">{new Date(w.created_at).toLocaleString()}</td>
                  <td className="p-4 text-sm font-mono">{w.user_tg_id}</td>
                  <td className="p-4 text-amber-400 font-bold">{w.amount}</td>
                  <td className="p-4 text-xs font-mono text-blue-400 break-all max-w-[200px]">{w.wallet_address}</td>
                  <td className="p-4">
                    {w.status === 'pending' ? (
                      <button onClick={() => handleCompleteWithdrawal(w.id)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-sm font-bold active:scale-95 transition-all">标记已打款</button>
                    ) : (
                      <span className="text-green-500 font-bold text-sm">✅ 已结清</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </main>
  );
}