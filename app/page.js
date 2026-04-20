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
  
  // 🚀 新增：业务明细状态
  const [myBets, setMyBets] = useState([]);
  const [matchPools, setMatchPools] = useState({});
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState('matches'); // 切换标签: matches, history, profile
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const CHANNEL_URL = "https://t.me/tonstriker_news";

  useEffect(() => {
    const initData = async () => {
      let currentUser = null;
      let startParam = null; 

      if (typeof window !== 'undefined') {
        try {
          const WebApp = (await import('@twa-dev/sdk')).default;
          WebApp.ready(); WebApp.expand();
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
              await supabase.from('users').update({ score: (inviter.score || 0) + 100 }).eq('tg_id', startParam); 
              await supabase.from('referral_logs').insert([{ inviter_id: startParam, new_user_id: tgId, reward_amount: 100 }]);
            }
          }
          await supabase.from('users').insert([{ tg_id: tgId, score: initialScore, invited_by: startParam }]);
          setUserScore(initialScore);
        } else {
          setUserScore(existingUser.score);
        }

        // 🚀 加载个人预测记录
        const { data: betData } = await supabase.from('predictions').select('*').eq('user_tg_id', tgId).order('created_at', { ascending: false });
        if (betData) setMyBets(betData);

        // 🚀 加载提现记录
        const { data: withdrawData } = await supabase.from('withdrawals').select('*').eq('user_tg_id', tgId).order('created_at', { ascending: false });
        if (withdrawData) setMyWithdrawals(withdrawData);

        // 🚀 加载邀请人数
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('invited_by', tgId);
        setReferralCount(count || 0);
      }

      // 🚀 实时计算全网奖金池
      const { data: allPredictions } = await supabase.from('predictions').select('match_name, team_picked, amount');
      if (allPredictions) {
        const pools = {};
        allPredictions.forEach(p => {
          if (!pools[p.match_name]) pools[p.match_name] = {};
          pools[p.match_name][p.team_picked] = (pools[p.match_name][p.team_picked] || 0) + p.amount;
        });
        setMatchPools(pools);
      }

      const { data: matchData } = await supabase.from('matches').select('*').order('match_time', { ascending: true });
      if (matchData) setMatches(matchData);

      const { data: topUsers } = await supabase.from('users').select('*').order('score', { ascending: false }).limit(10);
      if (topUsers) setLeaderboard(topUsers);
    };
    initData();
  }, [activeTab]);

  const isMatchLocked = (matchTime) => {
    if (!matchTime) return false;
    return new Date() >= new Date(new Date(matchTime).getTime() - 30 * 60000); 
  };

  const calculateOdds = (matchName, team) => {
    const pool = matchPools[matchName];
    if (!pool || !pool[team]) return "---";
    const teamA = Object.keys(pool)[0];
    const teamB = Object.keys(pool)[1];
    if (!teamA || !teamB) return "---";
    
    const totalPool = (pool[teamA] || 0) + (pool[teamB] || 0);
    const myTeamPool = pool[team] || 1;
    // 扣除 10% 抽水后的预计赔率
    const odds = (totalPool * 0.9) / myTeamPool;
    return odds.toFixed(2);
  };

  const handleShare = () => {
    const myId = tgUser?.id || "";
    const shareText = `🔥 江苏超级联赛开战！注册领200积分，支持主队瓜分90%奖池！加入频道获取密报：${CHANNEL_URL}`;
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
    if (!address) return alert("❌ 请先连接 TON 钱包！");
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 500) return alert("最低提现额度为 500 积分");
    if (amount > userScore) return alert("可用积分不足！");
    const tgId = tgUser ? tgUser.id.toString() : 'WalletUser';
    const newScore = userScore - amount;
    setUserScore(newScore);
    await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
    await supabase.from('withdrawals').insert([{ user_tg_id: tgId, wallet_address: address, amount: amount }]);
    alert("✅ 提现申请已提交！");
    setShowWithdraw(false);
  };

  const handlePlaceBet = async () => {
    if (isMatchLocked(selectedMatch.match_time)) return alert("❌ 已封盘！");
    if (!pickedTeam || !address) return alert("请选择队伍并连接钱包！");
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 360, 
        messages: [{ address: "UQD_BlGWjwMnVqb3jetXwKWy0aWMvNo-Bfm4XbGXQrpK0s7Y", amount: "10000000" }] 
      });
      const matchStr = `${selectedMatch.team_a} vs ${selectedMatch.team_b}`;
      const tgId = tgUser ? tgUser.id.toString() : 'WalletUser';
      await supabase.from('predictions').insert([{ user_tg_id: tgId, match_name: matchStr, team_picked: pickedTeam, amount: betAmount }]);
      setUserScore(userScore + betAmount);
      await supabase.from('users').update({ score: userScore + betAmount }).eq('tg_id', tgId);
      alert(`✅ 预测成功！`);
      setSelectedMatch(null);
    } catch (error) { alert("❌ 支付失败"); }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-[#020617] text-slate-200">
      {/* 顶部滚动播报 */}
      <div className="w-full bg-amber-500/10 py-1.5 mb-4 overflow-hidden border-b border-amber-500/10">
        <div className="animate-marquee inline-block text-[10px] text-amber-500 font-bold uppercase tracking-[0.2em]">
           ⚽️ 懂球帝数据已同步 • 4月25日江苏超级联赛火热预售中 • 平台抽水仅10% • 欢迎加入官方频道 ${CHANNEL_URL}获取最新赔率波动
        </div>
      </div>

      <header className="w-full flex justify-between items-center mb-6">
        <h1 className="text-xl font-black text-amber-500 italic">TONStriker</h1>
        <TonConnectButton />
      </header>

      {/* 核心资产卡片 */}
      <div className="w-full bg-slate-900 border border-slate-800 p-5 rounded-3xl mb-6 shadow-2xl">
         <div className="flex justify-between items-start mb-4">
           <div>
             <p className="text-slate-500 text-xs font-bold uppercase">账户余额</p>
             <p className="text-4xl font-black text-amber-500 tracking-tighter">{userScore} <span className="text-sm font-normal text-slate-400">$GOAL</span></p>
           </div>
           <button onClick={() => setShowWithdraw(true)} className="bg-amber-500 text-slate-950 px-4 py-2 rounded-xl font-black text-xs hover:bg-amber-400 transition-colors">提现</button>
         </div>
         <div className="flex space-x-6 border-t border-slate-800 pt-4">
            <div className="text-center">
              <p className="text-slate-500 text-[10px] uppercase font-bold">累计邀请</p>
              <p className="font-bold text-slate-200">{referralCount} 人</p>
            </div>
            <div className="text-center border-l border-slate-800 pl-6">
              <p className="text-slate-500 text-[10px] uppercase font-bold">历史预测</p>
              <p className="font-bold text-slate-200">{myBets.length} 场</p>
            </div>
         </div>
      </div>

      {/* 导航标签 */}
      <div className="flex w-full space-x-2 mb-6 bg-slate-900 p-1 rounded-2xl border border-slate-800">
        <button onClick={() => setActiveTab('matches')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'matches' ? 'bg-slate-800 text-amber-500 shadow-inner' : 'text-slate-500'}`}>赛事大厅</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-slate-800 text-amber-500 shadow-inner' : 'text-slate-500'}`}>我的预测</button>
        <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'withdraw' ? 'bg-slate-800 text-amber-500 shadow-inner' : 'text-slate-500'}`}>资金详情</button>
      </div>

      {/* 1. 赛事列表 */}
      {activeTab === 'matches' && (
        <div className="w-full flex-1 space-y-4">
          <div className="w-full mb-4">
            <button onClick={handleShare} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest">📢 邀请好友 (注册领200积分)</button>
          </div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">⚽️ 正在接受下注的赛事</h2>
          {matches.map((match) => {
            const locked = isMatchLocked(match.match_time);
            const matchName = `${match.team_a} vs ${match.team_b}`;
            const poolA = matchPools[matchName]?.[match.team_a] || 0;
            const poolB = matchPools[matchName]?.[match.team_b] || 0;

            return (
              <div key={match.id} onClick={() => { if(!locked) { setSelectedMatch(match); setPickedTeam(null); } }} className={`p-5 rounded-3xl border transition-all ${locked ? 'bg-slate-900/40 border-slate-900 opacity-50 grayscale' : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl'}`}>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] text-slate-500 font-bold bg-slate-800 px-3 py-1 rounded-full uppercase">{match.match_time ? new Date(match.match_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'TBD'}</span>
                  {locked && <span className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-full font-black uppercase">CLOSED</span>}
                </div>
                <div className="flex justify-between items-center relative">
                  <div className="flex flex-col items-center w-[40%] text-center">
                    <img src={match.team_a_logo || "https://ui-avatars.com/api/?name=TeamA&rounded=true"} className="w-14 h-14 object-contain mb-3 drop-shadow-2xl" />
                    <span className="font-black text-sm">{match.team_a}</span>
                    <p className="text-[10px] text-slate-500 mt-1">池: <span className="text-slate-300">{poolA}</span></p>
                    <p className="text-[10px] text-amber-500 font-bold">赔率: {calculateOdds(matchName, match.team_a)}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center w-[20%]">
                    <span className="text-xl font-black text-slate-700 italic">VS</span>
                  </div>
                  <div className="flex flex-col items-center w-[40%] text-center">
                    <img src={match.team_b_logo || "https://ui-avatars.com/api/?name=TeamB&rounded=true"} className="w-14 h-14 object-contain mb-3 drop-shadow-2xl" />
                    <span className="font-black text-sm">{match.team_b}</span>
                    <p className="text-[10px] text-slate-500 mt-1">池: <span className="text-slate-300">{poolB}</span></p>
                    <p className="text-[10px] text-amber-500 font-bold">赔率: {calculateOdds(matchName, match.team_b)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. 个人预测记录 */}
      {activeTab === 'history' && (
        <div className="w-full flex-1 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">📋 我的投注流水</h2>
          {myBets.length === 0 ? <p className="text-center text-slate-600 py-10">暂无任何预测记录</p> : myBets.map(bet => (
            <div key={bet.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">{new Date(bet.created_at).toLocaleString()}</p>
                <p className="font-bold text-sm text-white">{bet.match_name}</p>
                <p className="text-xs text-amber-500 mt-1">支持：{bet.team_picked} | 投入：{bet.amount}</p>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold">等待结算</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. 资金详情/提现记录 */}
      {activeTab === 'withdraw' && (
        <div className="w-full flex-1 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">🏦 资金提现追踪</h2>
          {myWithdrawals.length === 0 ? <p className="text-center text-slate-600 py-10">暂无提现历史</p> : myWithdrawals.map(w => (
            <div key={w.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">{new Date(w.created_at).toLocaleString()}</p>
                <p className="font-bold text-amber-500">提取 {w.amount} $GOAL</p>
                <p className="text-[10px] text-slate-600 mt-1 break-all">钱包: {w.wallet_address.substring(0,6)}...{w.wallet_address.substring(w.wallet_address.length-4)}</p>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${w.status === 'completed' ? 'bg-green-900/30 text-green-500' : 'bg-amber-900/30 text-amber-500'}`}>
                {w.status === 'completed' ? 'Success' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 全局排行榜 */}
      <div className="w-full mt-10 pb-10">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">🏆 财富名人堂</h2>
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
          {leaderboard.map((user, index) => (
             <div key={user.id} className="flex justify-between items-center p-4 border-b border-slate-800/50 last:border-0">
               <span className="text-slate-400 font-bold text-sm">#{index + 1} <span className="ml-2 font-mono">{user.tg_id.substring(0,4)}***</span></span>
               <span className="text-amber-500 font-black">{user.score}</span>
             </div>
          ))}
        </div>
      </div>

      {/* 提现 Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,1)]">
            <h3 className="text-2xl font-black mb-2 text-white italic">提现申请</h3>
            <p className="text-xs text-slate-500 mb-8 uppercase tracking-widest">庄家将在24小时内链上打款</p>
            <input type="number" placeholder="最低 500" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white mb-8 outline-none focus:border-amber-500 transition-all font-black text-xl"/>
            <div className="flex space-x-4">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs tracking-widest">取消</button>
              <button onClick={handleWithdrawSubmit} className="flex-1 py-4 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-amber-500/20">确认提取</button>
            </div>
          </div>
        </div>
      )}

      {/* 下注 Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/90 flex flex-col justify-end z-50 backdrop-blur-md">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-slate-900 rounded-t-[3rem] p-8 border-t border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-center font-black text-white mb-8 uppercase tracking-widest italic text-lg">确认您的支持</h3>
            <div className="flex space-x-4 mb-10">
              <button onClick={() => setPickedTeam(selectedMatch.team_a)} className={`flex-1 py-6 rounded-3xl font-black transition-all ${pickedTeam === selectedMatch.team_a ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-105' : 'bg-slate-800 text-slate-600'}`}>{selectedMatch.team_a}</button>
              <button onClick={() => setPickedTeam(selectedMatch.team_b)} className={`flex-1 py-6 rounded-3xl font-black transition-all ${pickedTeam === selectedMatch.team_b ? 'bg-red-600 text-white ring-4 ring-red-500/30 scale-105' : 'bg-slate-800 text-slate-600'}`}>{selectedMatch.team_b}</button>
            </div>
            <button onClick={handlePlaceBet} className={`w-full py-6 rounded-3xl font-black text-sm tracking-widest uppercase transition-all ${pickedTeam ? 'bg-amber-500 text-slate-950 shadow-xl shadow-amber-500/20' : 'bg-slate-800 text-slate-700'}`}>{pickedTeam ? `支付 0.01 TON 支持 ${pickedTeam}` : '请先选择上方队伍'}</button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 25s linear infinite; }
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