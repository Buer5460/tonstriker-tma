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

  useEffect(() => {
    const initData = async () => {
      let currentUser = null;
      let startParam = null; // 捕获邀请人的 ID

      if (typeof window !== 'undefined') {
        try {
          const WebApp = (await import('@twa-dev/sdk')).default;
          WebApp.ready();
          WebApp.expand();
          currentUser = WebApp.initDataUnsafe?.user;
          startParam = WebApp.initDataUnsafe?.start_param; // 获取裂变参数
          setTgUser(currentUser);
        } catch (e) { console.log("非TG环境"); }
      }

      if (currentUser) {
        const tgId = currentUser.id.toString();
        const { data: existingUser } = await supabase.from('users').select('*').eq('tg_id', tgId).single();
        
        if (!existingUser) {
          // 🚀 核心裂变逻辑：新用户首次注册
          let initialScore = 1000;
          
          // 如果是别人邀请来的（且不是自己点自己）
          if (startParam && startParam !== tgId) {
            initialScore += 100; // 新人多给 100 初始资金奖励
            
            // 给邀请人发 50 积分奖励，并记录流水防刷
            const { data: inviter } = await supabase.from('users').select('score').eq('tg_id', startParam).single();
            if (inviter) {
              await supabase.from('users').update({ score: inviter.score + 50 }).eq('tg_id', startParam);
              await supabase.from('referral_logs').insert([{ inviter_id: startParam, new_user_id: tgId, reward_amount: 50 }]);
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

      // 获取比赛并按时间排序
      const { data: matchData } = await supabase.from('matches').select('*').order('match_time', { ascending: true });
      if (matchData) setMatches(matchData);

      const { data: topUsers } = await supabase.from('users').select('*').order('score', { ascending: false }).limit(10);
      if (topUsers) setLeaderboard(topUsers);
    };
    initData();
  }, []);

  // 🛡️ 风控：检查是否进入赛前 30 分钟封盘期
  const isMatchLocked = (matchTime) => {
    if (!matchTime) return false;
    const now = new Date();
    const startTime = new Date(matchTime);
    const lockTime = new Date(startTime.getTime() - 30 * 60000); 
    return now >= lockTime;
  };

  // 📢 裂变引擎：带上自己的 TG ID 作为邀请码
  const handleShare = () => {
    const myId = tgUser?.id || "";
    const shareText = "🔥 我正在预测江苏超级联赛！点我链接加入，你我各得高额积分奖励！";
    // ⚠️ 把链接换成了带 startapp 参数的专属链接
    const botUrl = `https://t.me/TONStriker2026_bot/play?startapp=${myId}`; 
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`;
    
    if (typeof window !== 'undefined') {
      try {
        const WebApp = require('@twa-dev/sdk').default;
        WebApp.openTelegramLink(tgShareUrl);
      } catch (e) {
        window.open(tgShareUrl, '_blank');
      }
    }
  };

  const handlePlaceBet = async () => {
    // 下注前最后一道防线：时间校验
    if (isMatchLocked(selectedMatch.match_time)) return alert("❌ 该场比赛已进入封盘期（赛前30分钟），停止下注！");
    if (!pickedTeam) return alert("请先选择您要支持的队伍！");
    if (!address) return alert("❌ 请先在页面右上角连接 TON 钱包！");

    const testAmountTON = 0.01;
    const nanoTON = (testAmountTON * 1000000000).toString(); 
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 360, 
      messages: [{ address: "UQD_BlGWjwMnVqb3jetXwKWy0aWMvNo-Bfm4XbGXQrpK0s7Y", amount: nanoTON }]
    };

    try {
      await tonConnectUI.sendTransaction(transaction);
      const matchStr = `${selectedMatch.team_a} vs ${selectedMatch.team_b}`;
      const tgId = tgUser ? tgUser.id.toString() : 'WalletUser';

      const { error: insertError } = await supabase.from('predictions').insert([{
        user_tg_id: tgId, match_name: matchStr, team_picked: pickedTeam, amount: betAmount 
      }]);

      if (insertError) {
        alert("❌ 支付成功但记账失败: " + insertError.message);
      } else {
        const newScore = userScore + betAmount;
        setUserScore(newScore);
        await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
        alert(`✅ 支付成功！已收到真金白银，您的积分已发放并下注！`);
      }
      setSelectedMatch(null);
      setPickedTeam(null);
    } catch (error) {
      alert("❌ 支付已取消或失败。");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-900 text-white relative">
      <header className="w-full flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-black text-yellow-400 italic">TONStriker</h1>
        <TonConnectButton />
      </header>

      <div className="w-full bg-gradient-to-r from-gray-800 to-gray-800/50 p-5 rounded-2xl border border-gray-700 shadow-xl mb-6 flex justify-between items-center">
         <div>
           <p className="text-gray-400 text-xs mb-1 tracking-wider">云端可用积分</p>
           <p className="text-2xl font-black text-yellow-400">{userScore === 0 ? '读取中...' : `💰 ${userScore}`}</p>
         </div>
         <span className="text-sm font-bold text-gray-300">{tgUser?.first_name || '访客'}</span>
      </div>

      <div className="w-full mb-8">
        <button onClick={handleShare} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">📢 召唤好友，拿 50 积分奖励！</button>
      </div>

      <div className="w-full flex-1 mb-10">
        <h2 className="font-bold mb-4 italic text-gray-400">⚽️ 本地热点赛事 (封盘: 赛前30分)</h2>
        <div className="space-y-4">
          {matches.map((match) => {
            const locked = isMatchLocked(match.match_time);
            return (
              <div key={match.id} onClick={() => { if(!locked) { setSelectedMatch(match); setPickedTeam(null); } }} className={`p-5 rounded-xl border transition-all cursor-pointer shadow-md ${locked ? 'bg-gray-800/30 border-gray-800 grayscale' : 'bg-gray-800 border-gray-700 active:scale-95'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">{match.match_time ? new Date(match.match_time).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '待定'}</span>
                  {locked && <span className="text-[10px] bg-red-900 text-red-200 px-2 py-1 rounded">已封盘</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold w-2/5 text-center">{match.team_a}</span>
                  <span className="text-yellow-500 font-black w-1/5 text-center">VS</span>
                  <span className="font-bold w-2/5 text-center">{match.team_b}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full pb-10">
        <h2 className="font-bold mb-4 italic text-gray-400">🏆 财富排行榜</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {leaderboard.length === 0 ? <p className="p-4 text-center text-gray-500">虚位以待</p> : leaderboard.map((user, index) => (
             <div key={user.id} className="flex justify-between items-center p-4 border-b border-gray-700/50 last:border-0">
               <span className="text-gray-400">#{index + 1} {user.tg_id.substring(0,3)}***</span>
               <span className="text-yellow-400 font-bold">{user.score}</span>
             </div>
          ))}
        </div>
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-gray-800 rounded-t-3xl p-8 border-t-2 border-yellow-500/50">
            <h3 className="text-xl font-bold text-center mb-6">支持您的主队</h3>
            <div className="flex space-x-4 mb-8">
              <button onClick={() => setPickedTeam(selectedMatch.team_a)} className={`flex-1 py-4 rounded-xl font-bold ${pickedTeam === selectedMatch.team_a ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-gray-700 text-gray-400'}`}>{selectedMatch.team_a}</button>
              <button onClick={() => setPickedTeam(selectedMatch.team_b)} className={`flex-1 py-4 rounded-xl font-bold ${pickedTeam === selectedMatch.team_b ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-gray-700 text-gray-400'}`}>{selectedMatch.team_b}</button>
            </div>
            <button onClick={handlePlaceBet} className={`w-full py-4 rounded-2xl font-black text-lg ${pickedTeam ? 'bg-yellow-400 text-black' : 'bg-gray-600 text-gray-400'}`}>{pickedTeam ? `支付 0.01 TON 支持 ${pickedTeam}` : '请先选择队伍'}</button>
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