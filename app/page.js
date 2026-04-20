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
  
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // 📡 运营数据：频道链接
  const CHANNEL_URL = "https://t.me/tonstriker_news";

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
          let initialScore = 1000;
          if (startParam && startParam !== tgId) {
            initialScore += 200; 
            const { data: inviter } = await supabase.from('users').select('score').eq('tg_id', startParam).single();
            if (inviter) {
              await supabase.from('users').update({ score: inviter.score + 100 }).eq('tg_id', startParam); 
              await supabase.from('referral_logs').insert([{ inviter_id: startParam, new_user_id: tgId, reward_amount: 100 }]);
            }
          }
          await supabase.from('users').insert([{ tg_id: tgId, score: initialScore, invited_by: startParam }]);
          setUserScore(initialScore);
        } else {
          setUserScore(existingUser.score);
        }
      } else { setUserScore(1000); }

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
    const shareText = `🔥 【官方指定】我在预测江苏超级联赛！注册领200积分，支持家乡球队，瓜分90%奖金池！快来官方频道获取最新密报：${CHANNEL_URL}`;
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
    const newScore = userScore - amount;
    setUserScore(newScore);
    await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
    await supabase.from('withdrawals').insert([{ user_tg_id: tgId, wallet_address: address, amount: amount }]);

    alert("✅ 提现申请已提交！庄家将在 24 小时内审核并打款。");
    setShowWithdraw(false);
    setWithdrawAmount('');
  };

  const handlePlaceBet = async () => {
    if (isMatchLocked(selectedMatch.match_time)) return alert("❌ 该场比赛已进入封盘期，停止下注！");
    if (!pickedTeam) return alert("请先选择队伍！");
    if (!address) return alert("❌ 请先连接 TON 钱包！");

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 360, 
      messages: [{ address: "UQD_BlGWjwMnVqb3jetXwKWy0aWMvNo-Bfm4XbGXQrpK0s7Y", amount: "10000000" }] 
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
    <main className="flex min-h-screen flex-col items-center p-4 bg-[#0f172a] text-white relative">
      {/* 🚀 新增：顶部“提现成功”实时社交播报 */}
      <div className="w-full bg-amber-500/10 border-b border-amber-500/20 py-2 mb-4 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] text-amber-400 font-bold uppercase tracking-widest">
           🔥 恭喜 TG用户 138*** 提现 500 $GOAL 成功 • 恭喜 TG用户 721*** 提现 1000 $GOAL 成功 • 恭喜 TG用户 552*** 提现 2000 $GOAL 成功 •
        </div>
      </div>

      <header className="w-full flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-black text-amber-400 italic tracking-wider">TONStriker</h1>
        <TonConnectButton />
      </header>

      <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-2xl mb-6 flex justify-between items-end">
         <div>
           <p className="text-slate-400 text-xs mb-1">可用积分 ($GOAL)</p>
           <p className="text-4xl font-black text-amber-400">{userScore === 0 ? '...' : userScore}</p>
         </div>
         <button onClick={() => setShowWithdraw(true)} className="bg-amber-500/20 text-amber-400 border border-amber-500/50 px-4 py-2 rounded-lg font-bold text-sm">申请提现</button>
      </div>

      {/* 📢 裂变 2.0 按钮 */}
      <div className="w-full mb-4">
        <button onClick={handleShare} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">📢 邀请好友 (注册领200积分)</button>
      </div>

      {/* 🚀 新增：官方频道直通车 */}
      <div className="w-full mb-8">
        <a href={CHANNEL_URL} target="_blank" className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between group active:scale-95 transition-all">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📡</span>
            <div>
              <p className="font-bold text-white group-hover:text-amber-400 transition-colors">加入官方情报频道</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">获取内部赔率与实时中奖战报</p>
            </div>
          </div>
          <span className="text-slate-500 text-xl">→</span>
        </a>
      </div>

      {/* 赛事大厅 */}
      <div className="w-full flex-1 mb-10">
        <h2 className="font-bold mb-4 text-slate-400 flex items-center"><span className="w-2 h-5 bg-amber-500 mr-2 rounded-full"></span>江苏超级联赛 (预售)</h2>
        <div className="space-y-4">
          {matches.map((match) => {
            const locked = isMatchLocked(match.match_time);
            return (
              <div key={match.id} onClick={() => { if(!locked) { setSelectedMatch(match); setPickedTeam(null); } }} className={`p-4 rounded-2xl border transition-all ${locked ? 'bg-slate-800/40 border-slate-800 grayscale' : 'bg-slate-800 border-slate-700 active:scale-95 shadow-md'}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-500">{match.match_time ? new Date(match.match_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '待定'}</span>
                  {locked && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">已封盘</span>}
                </div>
                <div className="flex justify-between items-center px-2">
                  <div className="flex flex-col items-center w-1/3">
                    <img src={match.team_a_logo || "https://ui-avatars.com/api/?name=TeamA&rounded=true"} className="w-12 h-12 object-contain mb-1" />
                    <span className="font-bold text-xs">{match.team_a}</span>
                  </div>
                  <span className="text-lg font-black text-amber-500 italic">VS</span>
                  <div className="flex flex-col items-center w-1/3">
                    <img src={match.team_b_logo || "https://ui-avatars.com/api/?name=TeamB&rounded=true"} className="w-12 h-12 object-contain mb-1" />
                    <span className="font-bold text-xs">{match.team_b}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 提现弹窗 */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 p-6 rounded-3xl border border-amber-500/30 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">积分兑换 TON</h3>
            <p className="text-xs text-slate-500 mb-6">您的钱包: <br/><span className="text-amber-500 break-all">{address || '未连接'}</span></p>
            <input type="number" placeholder="最低提现 500" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white mb-6 outline-none focus:border-amber-500"/>
            <div className="flex space-x-3">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button onClick={handleWithdrawSubmit} className="flex-1 py-3 bg-amber-500 text-slate-900 rounded-xl font-black">确认申请</button>
            </div>
          </div>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/90 flex flex-col justify-end z-50 backdrop-blur-sm">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-slate-800 rounded-t-[2.5rem] p-8 border-t border-amber-500/30">
            <h3 className="text-xl font-black text-center mb-6 text-white">支持您的主队</h3>
            <div className="flex space-x-4 mb-8">
              <button onClick={() => setPickedTeam(selectedMatch.team_a)} className={`flex-1 py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam === selectedMatch.team_a ? 'bg-blue-600 ring-4 ring-blue-500/50 scale-105' : 'bg-slate-700 text-slate-500'}`}>{selectedMatch.team_a}</button>
              <button onClick={() => setPickedTeam(selectedMatch.team_b)} className={`flex-1 py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam === selectedMatch.team_b ? 'bg-red-600 ring-4 ring-red-500/50 scale-105' : 'bg-slate-700 text-slate-500'}`}>{selectedMatch.team_b}</button>
            </div>
            <button onClick={handlePlaceBet} className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${pickedTeam ? 'bg-amber-500 text-slate-900 shadow-xl' : 'bg-slate-700 text-slate-600'}`}>{pickedTeam ? `支付 0.01 TON 确认预测` : '请选择您的立场'}</button>
          </div>
        </div>
      )}
      
      {/* 跑马灯动画 CSS */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
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