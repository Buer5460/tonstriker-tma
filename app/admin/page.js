'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';

export default function AdminDashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // 【新魔法】防盗门状态控制
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // 极简密码校验（这里为了方便演示直接写死，真正的密码你等会儿可以自己改）
  const handleLogin = (e) => {
    e.preventDefault();
    // 默认密码设置为 888888，只有输入正确才能进入！
    if (password === '888888') {
      setIsAuthenticated(true);
      fetchPredictions(); // 密码正确后才去拉取数据
    } else {
      alert('❌ 密码错误！非法访问！');
      setPassword('');
    }
  };

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  const handleSettle = async (matchName, winningTeam) => {
    const confirmSettle = confirm(`警告：确认【${winningTeam}】获胜并全网派发奖金吗？操作不可逆！`);
    if (!confirmSettle) return;
    setLoading(true);

    const matchBets = predictions.filter(p => p.match_name === matchName);
    const winners = matchBets.filter(p => p.team_picked === winningTeam);
    const losers = matchBets.filter(p => p.team_picked !== winningTeam);

    const totalLoserPool = losers.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWinnerPrincipal = winners.reduce((sum, bet) => sum + bet.amount, 0);

    let logs = `✅ 【${matchName}】结算报告：\n`;

    for (const winner of winners) {
      let profit = 0;
      if (totalWinnerPrincipal > 0) {
          profit = Math.floor((winner.amount / totalWinnerPrincipal) * totalLoserPool);
      }
      const totalPayout = winner.amount + profit;

      const { data: userData } = await supabase.from('users').select('score').eq('tg_id', winner.user_tg_id).single();
      
      if (userData) {
        const newScore = userData.score + totalPayout;
        await supabase.from('users').update({ score: newScore }).eq('tg_id', winner.user_tg_id);
        logs += `TG用户 ${winner.user_tg_id} 赢回 ${totalPayout} 分\n`;
      }
      await supabase.from('predictions').delete().eq('id', winner.id);
    }

    for (const loser of losers) {
      await supabase.from('predictions').delete().eq('id', loser.id);
    }

    alert(logs || "这场比赛没人下注！");
    fetchPredictions(); 
    setLoading(false);
  };

  // 【新魔法】如果没验证通过，只显示这扇“防盗门”
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl border border-red-900/50 shadow-2xl w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-4xl mb-4 block">👁️</span>
            <h1 className="text-xl font-bold text-gray-300">系统最高权限</h1>
          </div>
          <input 
            type="password" 
            placeholder="请输入通行密钥" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-red-500 transition-colors text-center tracking-[0.5em]"
          />
          <button type="submit" className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 rounded-xl transition-all active:scale-95">
            请求接入
          </button>
        </form>
      </main>
    );
  }

  // 验证通过后，显示真正的上帝视角后台
  const matches = [...new Set(predictions.map(p => p.match_name))];

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-black text-red-500 mb-8 flex items-center">👁️ 上帝视角：庄家结算中心</h1>
      {predictions.length === 0 ? (
        <p className="text-gray-400">目前没有任何用户的下注记录。</p>
      ) : (
        <div className="space-y-8">
          {matches.map(matchName => {
            const betsForMatch = predictions.filter(p => p.match_name === matchName);
            const totalAmount = betsForMatch.reduce((sum, bet) => sum + bet.amount, 0);
            const teamA = matchName.split(' vs ')[0];
            const teamB = matchName.split(' vs ')[1];

            return (
              <div key={matchName} className="bg-gray-800 p-6 rounded-xl border border-red-900/50">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">{matchName}</h2>
                  <span className="text-yellow-400 font-bold">总奖池: {totalAmount} 积分</span>
                </div>
                <div className="flex space-x-4">
                  <button disabled={loading} onClick={() => handleSettle(matchName, teamA)} className="flex-1 py-3 bg-red-900 hover:bg-red-800 rounded font-bold transition-all">宣布【{teamA}】获胜并分钱</button>
                  <button disabled={loading} onClick={() => handleSettle(matchName, teamB)} className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 rounded font-bold transition-all">宣布【{teamB}】获胜并分钱</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}