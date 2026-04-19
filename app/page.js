'use client'

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase'; 
import { TonConnectUIProvider, TonConnectButton, useTonAddress } from '@tonconnect/ui-react';

function AppContent() {
  const address = useTonAddress(); 
  const [tgUser, setTgUser] = useState(null);
  const [matches, setMatches] = useState([]);
  const [userScore, setUserScore] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [pickedTeam, setPickedTeam] = useState(null);
  
  // 【新魔法】用来存放排行榜数据的数组
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const initData = async () => {
      let currentUser = null;
      if (typeof window !== 'undefined') {
        try {
          const WebApp = (await import('@twa-dev/sdk')).default;
          WebApp.ready();
          WebApp.expand();
          if (WebApp.initDataUnsafe?.user) {
            currentUser = WebApp.initDataUnsafe.user;
            setTgUser(currentUser);
          }
        } catch (e) { console.log("非TG环境"); }
      }

      if (currentUser) {
        const tgId = currentUser.id.toString();
        const { data: existingUser } = await supabase.from('users').select('*').eq('tg_id', tgId).single();
        if (existingUser) {
          setUserScore(existingUser.score);
        } else {
          await supabase.from('users').insert([{ tg_id: tgId, score: 1000 }]);
          setUserScore(1000);
        }
      } else {
         setUserScore(1000);
      }

      // 获取比赛
      const { data: matchData } = await supabase.from('matches').select('*');
      if (matchData) setMatches(matchData);

      // 【新魔法】获取全网积分最高的前 10 名用户
      const { data: topUsers } = await supabase
        .from('users')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);
      if (topUsers) setLeaderboard(topUsers);
    };
    initData();
  }, []);

  const handlePlaceBet = async () => {
    if (!pickedTeam) return alert("请先选择您要支持的队伍！");
    if (userScore < betAmount) return alert("积分不足！");

    const newScore = userScore - betAmount;
    setUserScore(newScore);
    const matchStr = `${selectedMatch.team_a} vs ${selectedMatch.team_b}`;
    const savedTeam = pickedTeam; 
    const savedAmount = betAmount;
    
    setSelectedMatch(null); 
    setPickedTeam(null);

    if (tgUser) {
      const tgId = tgUser.id.toString();
      const { error: updateError } = await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
      const { error: insertError } = await supabase.from('predictions').insert([{
        user_tg_id: tgId,
        match_name: matchStr,
        team_picked: savedTeam,
        amount: savedAmount
      }]);

      if (updateError || insertError) {
        alert("❌ 记账报错: " + (updateError?.message || "") + " | " + (insertError?.message || ""));
      } else {
        alert(`✅ 预测成功！您已投入 ${savedAmount} 积分支持【${savedTeam}】。收据已存入云端！`);
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-900 text-white relative">
      <header className="w-full flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-black text-yellow-400 italic">TONStriker</h1>
        <div className="flex flex-col items-end space-y-1">
          <TonConnectButton />
        </div>
      </header>

      {/* 用户卡片 */}
      <div className="w-full bg-gradient-to-r from-gray-800 to-gray-800/50 p-5 rounded-2xl border border-gray-700 shadow-xl mb-8 flex justify-between items-center">
         <div>
           <p className="text-gray-400 text-xs mb-1 tracking-wider">云端可用积分</p>
           <p className="text-2xl font-black text-yellow-400">
             {userScore === 0 ? '读取中...' : `💰 ${userScore}`}
           </p>
         </div>
         <div className="flex items-center space-x-3">
           <span className="text-sm font-bold text-gray-300">{tgUser?.first_name || '访客模式'}</span>
         </div>
      </div>

      {/* 比赛列表 */}
      <div className="w-full flex-1 mb-10">
        <h2 className="font-bold mb-4 italic text-gray-400">🔥 预测赢大奖</h2>
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} 
                 onClick={() => { setSelectedMatch(match); setPickedTeam(null); }} 
                 className="bg-gray-800 p-5 rounded-xl border border-gray-700 active:scale-95 transition-all cursor-pointer shadow-md">
              <div className="flex justify-between items-center">
                <span className="font-bold w-2/5 text-center text-lg">{match.team_a}</span>
                <span className="text-yellow-500 font-black w-1/5 text-center text-xl">VS</span>
                <span className="font-bold w-2/5 text-center text-lg">{match.team_b}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 【新魔法】炫酷排行榜 UI */}
      <div className="w-full pb-10">
        <h2 className="font-bold mb-4 italic text-gray-400">🏆 全网财富排行榜</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-md">
          {leaderboard.length === 0 ? (
             <p className="p-4 text-center text-gray-500 text-sm">暂无数据，快来拿下榜一！</p>
          ) : (
             leaderboard.map((user, index) => (
               <div key={user.id} className="flex justify-between items-center p-4 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors">
                 <div className="flex items-center space-x-4">
                   {/* 前三名给特殊颜色 */}
                   <span className={`font-black w-6 text-center ${index === 0 ? 'text-yellow-400 text-xl' : index === 1 ? 'text-gray-300 text-lg' : index === 2 ? 'text-amber-600 text-lg' : 'text-gray-500'}`}>
                     #{index + 1}
                   </span>
                   {/* 保护隐私，将 TG ID 中间几位打码 */}
                   <span className="font-mono text-sm text-gray-300">
                     {user.tg_id.substring(0, 3)}***{user.tg_id.slice(-3)}
                   </span>
                 </div>
                 <span className="text-yellow-400 font-bold">{user.score}</span>
               </div>
             ))
          )}
        </div>
      </div>

      {/* 下注弹窗保持不变 */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-gray-800 rounded-t-3xl p-8 border-t-2 border-yellow-500/50 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-4 text-gray-300">请选择支持队伍</h3>
            <div className="flex space-x-4 mb-6">
              <button onClick={() => setPickedTeam(selectedMatch.team_a)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${pickedTeam === selectedMatch.team_a ? 'bg-blue-600 text-white border-2 border-blue-400' : 'bg-gray-700 text-gray-400 border-2 border-transparent'}`}>{selectedMatch.team_a}</button>
              <button onClick={() => setPickedTeam(selectedMatch.team_b)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${pickedTeam === selectedMatch.team_b ? 'bg-red-600 text-white border-2 border-red-400' : 'bg-gray-700 text-gray-400 border-2 border-transparent'}`}>{selectedMatch.team_b}</button>
            </div>
            <div className="mb-8">
              <div className="flex justify-between text-gray-400 mb-2"><span>投入积分</span><span className="text-yellow-400 font-bold">{betAmount} $GOAL</span></div>
              <input type="range" min="10" max="500" step="10" value={betAmount} onChange={(e) => setBetAmount(parseInt(e.target.value))} className="w-full accent-yellow-400"/>
            </div>
            <button onClick={handlePlaceBet} className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${pickedTeam ? 'bg-yellow-400 text-black active:scale-95' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>{pickedTeam ? `确认支持 ${pickedTeam}` : '请先选择队伍'}</button>
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