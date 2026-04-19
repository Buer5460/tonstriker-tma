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

  useEffect(() => {
    const initData = async () => {
      let currentUser = null;

      // 1. 获取 Telegram 用户身份
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

      // 2. 云端读档
      if (currentUser) {
        const tgId = currentUser.id.toString();
        const { data: existingUser, error: fetchError } = await supabase
          .from('users').select('*').eq('tg_id', tgId).single();

        if (existingUser) {
          setUserScore(existingUser.score);
        } else {
          const { error: insertError } = await supabase.from('users').insert([{ tg_id: tgId, score: 1000 }]);
          if (insertError) alert("⚠️ 新建云端账本失败: " + insertError.message);
          setUserScore(1000);
        }
      } else {
         setUserScore(1000);
      }

      // 3. 获取比赛列表
      const { data: matchData } = await supabase.from('matches').select('*');
      if (matchData) setMatches(matchData);
    };

    initData();
  }, []);

  // 4. 【核心魔法】带报警的真实扣分逻辑
  const handlePlaceBet = async () => {
    if (userScore < betAmount) return alert("积分不足！");

    const newScore = userScore - betAmount;
    
    // 第一步：画面先扣，保证丝滑
    setUserScore(newScore);
    setSelectedMatch(null); 

    // 第二步：真实写入数据库并汇报结果
    if (tgUser) {
      const tgId = tgUser.id.toString();
      const { error } = await supabase.from('users').update({ score: newScore }).eq('tg_id', tgId);
      
      if (error) {
        // 如果数据库报错，直接弹窗显示红字
        alert("❌ 数据库写入失败: " + error.message);
      } else {
        // 如果成功，弹出绿字
        alert(`✅ 预测成功！云端账本已真实更新，当前余额 ${newScore}。现在您可以随便刷新测试了！`);
      }
    } else {
      // 提醒你没在 TG 里
      alert("⚠️ 测试提示：您目前不在 Telegram 软件内，系统获取不到身份，积分仅在本地测试，刷新后不保存。");
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

      <div className="w-full bg-gradient-to-r from-gray-800 to-gray-800/50 p-5 rounded-2xl border border-gray-700 shadow-xl mb-6 flex justify-between items-center">
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

      <div className="w-full flex-1">
        <h2 className="font-bold mb-4 italic text-gray-400">🔥 预测赢大奖</h2>
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} onClick={() => setSelectedMatch(match)} className="bg-gray-800 p-5 rounded-xl border border-gray-700 active:scale-95 transition-all cursor-pointer shadow-md">
              <div className="flex justify-between items-center">
                <span className="font-bold w-2/5 text-center text-lg">{match.team_a}</span>
                <span className="text-yellow-500 font-black w-1/5 text-center text-xl">VS</span>
                <span className="font-bold w-2/5 text-center text-lg">{match.team_b}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="flex-1" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-gray-800 rounded-t-3xl p-8 border-t-2 border-yellow-500/50">
            <h3 className="text-xl font-bold text-center mb-6">预测：{selectedMatch.team_a} vs {selectedMatch.team_b}</h3>
            <div className="mb-8">
              <div className="flex justify-between text-gray-400 mb-2">
                <span>投入积分</span>
                <span className="text-yellow-400 font-bold">{betAmount} $GOAL</span>
              </div>
              <input type="range" min="10" max="500" step="10" value={betAmount} onChange={(e) => setBetAmount(parseInt(e.target.value))} className="w-full accent-yellow-400"/>
            </div>
            <button onClick={handlePlaceBet} className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black text-lg">确认预测</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return <main className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-yellow-400">Loading App...</p></main>;

  return (
    <TonConnectUIProvider manifestUrl="https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json">
      <AppContent />
    </TonConnectUIProvider>
  );
}