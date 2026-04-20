'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase'; 
import { TonConnectUIProvider, TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

function AppContent() {
  const address = useTonAddress(); 
  const [tonConnectUI] = useTonConnectUI();
  
  const [tgUser, setTgUser] = useState(null);
  const [matches, setMatches] = useState([]);
  const [userScore, setUserScore] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [pickedTeam, setPickedTeam] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // 提现状态控制
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    const initData = async () => {
      let currentUser = null;
      let startParam = null; 

      if (typeof window !== 'undefined') {
        try {
          const WebApp = (await import('@twa-dev/sdk')).default;
          WebApp.ready();
          WebApp.expand();
          currentUser = WebApp.initDataUnsafe?.user;
          startParam = WebApp.initDataUnsafe?.start_param; 
          setTgUser(currentUser);
        } catch (e) { console.log("非TG环境"); }
      }

      if (currentUser) {
        const tgId = currentUser.id.toString();
        const { data: existingUser } = await supabase.from('users').select('*').eq('tg_id', tgId).single();
        
        if (!existingUser) {
          // 🚀 裂变 2.0 活动逻辑 (限时双倍奖励)
          let initialScore = 1000;
          if (startParam && startParam !== tgId) {
            initialScore += 200; // 新人拿 200
            const { data: inviter } = await supabase.from('users').select('score').eq('tg_id', startParam).single();
            if (inviter) {
              await supabase.from('users').update({ score: inviter.score + 100 }).eq('tg_id', startParam); // 邀请人拿 100
              await supabase.from('referral_logs').insert([{ inviter_id: startParam, new_user_id: tgId, reward_amount: 100 }]);
            }
          }
          await supabase.from('users').insert([{ tg_id: tgId, score: initialScore, invited_by: startParam }]);
          setUserScore(initialScore);
        } else {
          setUserScore(existingUser.score);
        }
      } else {
         setUserScore(1000);
      }

      const { data: matchData } = await supabase.from('matches').select('*').order('match_time', { ascending: true });
      if (matchData) setMatches(matchData);

      const { data: topUsers } = await supabase.from('users').select('*').order('score', { ascending: false }).limit(10);
      if (topUsers) setLeaderboard(topUsers);
    };
    initData();
  }, []);

  const isMatchLocked = (matchTime) => {
    if (!matchTime) return false;
    const now = new Date();
    const lockTime = new Date(new Date(matchTime).getTime() - 30 * 60000); 
    return now >= lockTime;
  };

  const handleShare = () => {
    const myId = tgUser?.id || "";
    const shareText = "🔥 【限时活动】我在预测江苏超级联赛！现在点我链接加入，你拿200积分，我拿100积分！快来！";
    const botUrl = `https://t.me/TONStriker2026_bot/play?startapp=${myId}`; 
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`;
    if (typeof window !== 'undefined') {
      try {
        const WebApp = require('@twa-dev/sdk').default;
        WebApp.openTelegramLink(tgShareUrl);
      } catch (e) { window.open(tgShareUrl, '_blank'); }
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!address) return alert("❌ 请先在右上角连接您的 TON 钱包地址！");
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 500) return alert("最低提现额度为 500 积分");
    if (amount > userScore) return alert("您的可用积分不足！");

    const tgId = tgUser ? tgUser.id.toString() : 'WalletUser';
    
    // 1. 扣除本地与数据库积分
    const newScore = userScore - amount;
    setUserScore(newScore);
    await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
    
    // 2. 写入提现记录表
    await supabase.from('withdrawals').insert([{
      user_tg_id: tgId,
      wallet_address: address,
      amount: amount
    }]);

    alert("✅ 提现申请已提交！庄家将在 24 小时内审核并打款至您的 TON 钱包。");
    setShowWithdraw(false);
    setWithdrawAmount('');
  };

  const handlePlaceBet = async () => {
    if (isMatchLocked(selectedMatch.match_time)) return alert("❌ 该场比赛已进入封盘期，停止下注！");
    if (!pickedTeam) return alert("请先选择队伍！");
    if (!address) return alert("❌ 请先连接 TON 钱包！");

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 360, 
      messages: [{ address: "UQD_BlGWjwMnVqb3jetXwKWy0aWMvNo-Bfm4XbGXQrpK0s7Y", amount: "10000000" }] // 0.01 TON
    };

    try {
      await tonConnectUI.sendTransaction(transaction);
      const matchStr = `${selectedMatch.team_a} vs ${selectedMatch.team_b}`;
      const tgId = tgUser ? tgUser.id.toString() : 'WalletUser';

      await supabase.from('predictions').insert([{ user_tg_id: tgId, match_name: matchStr, team_picked: pickedTeam, amount: betAmount }]);
      const newScore = userScore + betAmount;
      setUserScore(newScore);
      await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
      
      alert(`✅ 支付成功！您的积分已更新，祝您好运！`);
      setSelectedMatch(null);
      setPickedTeam(null);
    } catch (error) { alert("❌ 支付已取消"); }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-6 bg-[#0f172a] text-white relative">
      <header className="w-full flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-black text-amber-400 italic tracking-wider">TONStriker</h1>
        <TonConnectButton />
      </header>

      {/* 资产卡片 */}
      <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-2xl mb-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
         <div className="flex justify-between items-end relative z-10">
           <div>
             <p className="text-slate-400 text-sm mb-2 font-medium">总资产 ($GOAL 积分)</p>
             <p className="text-4xl font-black text-amber-400 drop-shadow-md">{userScore === 0 ? '...' : userScore}</p>
           </div>
           <button onClick={() => setShowWithdraw(true)} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50 px-4 py-2 rounded-lg font-bold text-sm transition-all">提现 (Cash Out)</button>
         </div>
      </div>

      {/* 提现弹窗 */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-amber-500/30 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4 text-white">申请提现至钱包</h3>
            <p className="text-sm text-slate-400 mb-4">当前绑定的钱包: <br/><span className="text-amber-400 break-all">{address || '未绑定'}</span></p>
            <input type="number" placeholder="输入提取金额 (最低 500)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-white mb-6 focus:border-amber-500 outline-none"/>
            <div className="flex space-x-3">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold">取消</button>
              <button onClick={handleWithdrawSubmit} className="flex-1 py-3 bg-amber-500 text-slate-900 rounded-lg font-black">确认提取</button>
            </div>
          </div>
        </div>
      )}

      {/* 裂变横幅 2.0 */}
      <div className="w-full mb-8">
        <button onClick={handleShare} className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex flex-col items-center justify-center">
          <span className="text-lg">📢 邀请好友 (限时活动)</span>
          <span className="text-xs text-blue-200 mt-1 font-normal">邀请1人即得 100 积分，可直接提现！</span>
        </button>
      </div>

      {/* 赛事大厅 - 带有队徽 */}
      <div className="w-full flex-1 mb-10">
        <h2 className="font-bold mb-4 text-slate-400 flex items-center"><span className="w-2 h-6 bg-amber-500 mr-3 rounded-full"></span>预售赛程 (江苏超级联赛)</h2>
        <div className="space-y-4">
          {matches.map((match) => {
            const locked = isMatchLocked(match.match_time);
            return (
              <div key={match.id} onClick={() => { if(!locked) { setSelectedMatch(match); setPickedTeam(null); } }} className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${locked ? 'bg-slate-800/40 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500 shadow-lg'}`}>
                
                <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
                  <span className="text-xs text-slate-400 font-medium tracking-wide">
                    {match.match_time ? new Date(match.match_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '待定'}
                  </span>
                  {locked && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-md font-bold">已封盘</span>}
                </div>

                <div className="flex justify-between items-center px-2">
                  <div className="flex flex-col items-center w-1/3">
                    {match.team_a_logo ? <img src={match.team_a_logo} className="w-12 h-12 object-contain mb-2 drop-shadow-lg"/> : <div className="w-12 h-12 bg-slate-700 rounded-full mb-2"></div>}
                    <span className="font-bold text-sm text-center">{match.team_a}</span>
                  </div>
                  
                  <div className="w-1/3 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-amber-500 italic">VS</span>
                  </div>

                  <div className="flex flex-col items-center w-1/3">
                    {match.team_b_logo ? <img src={match.team_b_logo} className="w-12 h-12 object-contain mb-2 drop-shadow-lg"/> : <div className="w-12 h-12 bg-slate-700 rounded-full mb-2"></div>}
                    <span className="font-bold text-sm text-center">{match.team_b}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full pb-10">
        <h2 className="font-bold mb-4 text-slate-400">🏆 财富排行榜</h2>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {leaderboard.map((user, index) => (
             <div key={user.id} className="flex justify-between items-center p-4 border-b border-slate-700/50 last:border-0">
               <span className="text-slate-300 font-medium">
                 {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`} 
                 <span className="ml-2">{user.tg_id.substring(0,4)}***</span>
               </span>
               <span className="text-amber-400 font-black">{user.score}</span>
             </div>
          ))}
        </div>
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 bg-slate-900/90 flex flex-col justify-end z-50 backdrop-blur-sm">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-slate-800 rounded-t-[2rem] p-8 border-t border-amber-500/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <h3 className="text-xl font-black text-center mb-6 text-white">支持您的球队</h3>
            <div className="flex space-x-4 mb-8">
              <button onClick={() => setPickedTeam(selectedMatch.team_a)} className={`flex-1 py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam === selectedMatch.team_a ? 'bg-blue-600 text-white ring-4 ring-blue-500/50 scale-105' : 'bg-slate-700 text-slate-400'}`}>{selectedMatch.team_a}</button>
              <button onClick={() => setPickedTeam(selectedMatch.team_b)} className={`flex-1 py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam === selectedMatch.team_b ? 'bg-red-600 text-white ring-4 ring-red-500/50 scale-105' : 'bg-slate-700 text-slate-400'}`}>{selectedMatch.team_b}</button>
            </div>
            <button onClick={handlePlaceBet} className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-lg' : 'bg-slate-700 text-slate-500'}`}>{pickedTeam ? `支付 0.01 TON 确认预测` : '请先选择上方队伍'}</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;
  return (
    <TonConnectUIProvider manifestUrl="https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json">
      <AppContent />
    </TonConnectUIProvider>
  );
}