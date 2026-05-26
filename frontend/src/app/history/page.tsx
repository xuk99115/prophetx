'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Market {
  id: string;
  question: string;
  end_time: string;
  final_price: number | null;
  correct_outcome: string | null;
  status: string;
  total_stake: number;
  prediction_count: number;
  created_at: string;
}

interface UserPrediction {
  selected_outcome: string;
  stake_amount: number;
  result: string | null;
  market_question: string;
  market_end_time: string;
  market_final_price: number | null;
  market_correct_outcome: string | null;
}

export default function History() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userPredictions, setUserPredictions] = useState<UserPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'markets' | 'mine'>('markets');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userId = localStorage.getItem('user_id');

    Promise.all([
      // Fetch settled markets
      fetch('/api/markets/settled', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : []),
      // Fetch user's predictions on settled markets
      userId ? fetch(`/api/users/${userId}/predictions/settled`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : []) : Promise.resolve([])
    ]).then(([marketsData, predictionsData]) => {
      setMarkets(marketsData);
      setUserPredictions(predictionsData);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [router]);

  const getOutcomeLabel = (outcome: string) => {
    if (outcome === 'UP') return '📈 UP';
    if (outcome === 'DOWN') return '📉 DOWN';
    return outcome;
  };

  const getResultBadge = (result: string | null) => {
    if (!result) return <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs">等待中</span>;
    if (result === 'WON') return <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">✅ 获胜</span>;
    if (result === 'LOST') return <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">❌ 失败</span>;
    return <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs">{result}</span>;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8">
        <a href="/" className="text-gray-400 hover:text-white text-sm">← 返回首页</a>
        <h1 className="text-3xl font-bold text-cyan-400 mt-4">📜 历史市场</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('markets')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'markets' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          所有已结算市场
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'mine' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          我的预测
        </button>
      </div>

      {activeTab === 'markets' && (
        <div className="space-y-4">
          {markets.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">暂无已结算的市场</p>
            </div>
          ) : (
            markets.map(market => (
              <div key={market.id} className="bg-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{market.question}</h3>
                  {getResultBadge(market.correct_outcome ? 'SETTLED' : null)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">结束时间</p>
                    <p className="text-sm">{formatDate(market.end_time)}</p>
                  </div>
                  {market.final_price !== null && (
                    <div className="bg-gray-750 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">结算价格</p>
                      <p className="text-sm font-bold text-yellow-400">{market.final_price}</p>
                    </div>
                  )}
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">正确结果</p>
                    <p className="text-sm font-medium">
                      {market.correct_outcome ? getOutcomeLabel(market.correct_outcome) : '待定'}
                    </p>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">总质押 / 人数</p>
                    <p className="text-sm">{market.total_stake?.toLocaleString() || 0} / {market.prediction_count || 0}</p>
                  </div>
                </div>

                {/* Market outcomes breakdown */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-gray-750 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">📈 UP</p>
                    <p className="text-xl font-bold text-green-400">
                      {market.up_stake || 0}
                    </p>
                    <p className="text-xs text-gray-500">质押总额</p>
                  </div>
                  <div className="flex-1 bg-gray-750 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">📉 DOWN</p>
                    <p className="text-xl font-bold text-red-400">
                      {market.down_stake || 0}
                    </p>
                    <p className="text-xs text-gray-500">质押总额</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-4">
          {userPredictions.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">您还没有在任何已结算的市场下注</p>
            </div>
          ) : (
            userPredictions.map((pred, idx) => (
              <div key={idx} className="bg-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{pred.market_question}</h3>
                    <p className="text-gray-400 text-sm mt-1">结束时间: {formatDate(pred.market_end_time)}</p>
                  </div>
                  {getResultBadge(pred.result)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">您的预测</p>
                    <p className="text-lg font-bold">{getOutcomeLabel(pred.selected_outcome)}</p>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">下注金额</p>
                    <p className="text-lg font-bold text-yellow-400">{pred.stake_amount}</p>
                  </div>
                  {pred.market_final_price !== null && (
                    <div className="bg-gray-750 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">结算价格</p>
                      <p className="text-lg font-bold">{pred.market_final_price}</p>
                    </div>
                  )}
                </div>

                {pred.result && pred.market_correct_outcome && (
                  <div className="mt-4 p-3 bg-gray-750 rounded-lg">
                    <p className="text-sm">
                      正确结果: <span className="font-bold">{getOutcomeLabel(pred.market_correct_outcome)}</span>
                      {pred.result === 'WON' ? (
                        <span className="text-green-400 ml-2">→ 获胜！</span>
                      ) : (
                        <span className="text-red-400 ml-2">→ 失败</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}