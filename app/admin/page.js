'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase'; // 注意这里的路径回退了两层

export default function AdminDashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. 获取全网所有的下注底单
  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  // 2. 【核心魔法】一键结算分钱引擎
  const handleSettle = async (matchName, winningTeam) => {
    const confirmSettle = confirm(`警告：确认【${winningTeam}】获胜并全网派发奖金吗？操作不可逆！`);
    if (!confirmSettle) return;
    
    setLoading(true);

    // 找出这场比赛的所有收据
    const matchBets = predictions.filter(p => p.match_name === matchName);
    
    // 把赢家和输家分出来
    const winners = matchBets.filter(p => p.team_picked === winningTeam);
    const losers = matchBets.filter(p => p.team_picked !== winningTeam);

    // 算算输家一共输了多少钱（这就是咱们的奖金池）
    const totalLoserPool = losers.reduce((sum, bet) => sum + bet.amount, 0);
    // 算算赢家一共押了多少本金
    const totalWinnerPrincipal = winners.reduce((sum, bet) => sum + bet.amount, 0);

    let logs = `✅ 【${matchName}】结算报告：\n`;

    // 开始给赢家挨个派钱
    for (const winner of winners) {
      // 算法：退还本金 + 瓜分输家的钱（按本金比例瓜分）
      let profit = 0;
      if (totalWinnerPrincipal > 0) {
          // 赢家应得的利润 = (我的本金 / 所有赢家总本金) * 总奖金池
          profit = Math.floor((winner.amount / totalWinnerPrincipal) * totalLoserPool);
      }
      const totalPayout = winner.amount + profit;

      // 查出该赢家当前的余额
      const { data: userData } = await supabase.from('users').select('score').eq('tg_id', winner.user_tg_id).single();
      
      if (userData) {
        const newScore = userData.score + totalPayout;
        // 把派发的钱打进他的账户
        await supabase.from('users').update({ score: newScore }).eq('tg_id', winner.user_tg_id);
        logs += `TG用户 ${winner.user_tg_id} 赢回 ${totalPayout} 分 (本金${winner.amount}+利润${profit})\n`;
      }
      
      // 派完钱，销毁这张收据（防止重复派奖）
      await supabase.from('predictions').delete().eq('id', winner.id);
    }

    // 输家的收据也直接销毁（钱已经进奖金池了）
    for (const loser of losers) {
      await supabase.from('predictions').delete().eq('id', loser.id);
    }

    alert(logs || "这场比赛没人下注！");
    fetchPredictions(); // 刷新账本
    setLoading(false);
  };

  // 把同一场比赛的账单归类显示
  const matches = [...new Set(predictions.map(p => p.match_name))];

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-black text-red-500 mb-8 flex items-center">
        👁️ 上帝视角：庄家结算中心
      </h1>
      
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
                
                {/* 结算按钮 */}
                <div className="flex space-x-4">
                  <button disabled={loading} onClick={() => handleSettle(matchName, teamA)} className="flex-1 py-3 bg-red-900 hover:bg-red-800 rounded font-bold transition-all">
                    宣布【{teamA}】获胜并分钱
                  </button>
                  <button disabled={loading} onClick={() => handleSettle(matchName, teamB)} className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 rounded font-bold transition-all">
                    宣布【{teamB}】获胜并分钱
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}