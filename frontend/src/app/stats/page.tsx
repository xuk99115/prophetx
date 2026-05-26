'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface MarketStats {
  id: string;
  question: string;
  end_time: string;
  status: string;
  total_stake: number;
  prediction_count: number;
  up_stake: number;
  down_stake: number;
  up_count: number;
  down_count: number;
}

export default function Stats() {
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('/api/markets/all-stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setMarkets(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  const filteredMarkets = markets.filter(m => {
    if (filter === 'active') return m.status === 'ACTIVE';
    if (filter === 'settled') return m.status === 'SETTLED' || m.status === 'RESOLVED';
    return true;
  });

  const getOdds = (upStake: number, downStake: number) => {
    const total = upStake + downStake;
    if (total === 0) return { up: '1.00', down: '1.00' };
    const upOdds = (total / upStake).toFixed(2);
    const downOdds = (total / downStake).toFixed(2);
    return { up: upOdds, down: downOdds };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <h1 className="text-3xl font-bold text-cyan-400 mt-4">📊 市场统计</h1>
        <p className="text-gray-400 mt-2">查看所有市场的质押详情和赔率</p>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-4 mb-6">
        {(['all', 'active', 'settled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              filter === f ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? '全部' : f === 'active' ? '进行中' : '已结算'}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">市场总数</p>
          <p className="text-3xl font-bold text-cyan-400">{markets.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">总质押积分</p>
          <p className="text-3xl font-bold text-yellow-400">
            {markets.reduce((sum, m) => sum + (m.total_stake || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">总下注人数</p>
          <p className="text-3xl font-bold text-green-400">
            {markets.reduce((sum, m) => sum + (m.prediction_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Markets list */}
      <div className="space-y-4">
        {filteredMarkets.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">暂无市场数据</p>
          </div>
        ) : (
          filteredMarkets.map(market => {
            const odds = getOdds(market.up_stake || 0, market.down_stake || 0);
            const total = market.up_stake + market.down_stake;
            const upPct = total > 0 ? ((market.up_stake / total) * 100).toFixed(1) : '0.0';
            const downPct = total > 0 ? ((market.down_stake / total) * 100).toFixed(1) : '0.0';

            return (
              <div key={market.id} className="bg-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{market.question}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      结束: {formatDate(market.end_time)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm ${
                    market.status === 'ACTIVE' ? 'bg-green-600' : 'bg-gray-600'
                  }`}>
                    {market.status === 'ACTIVE' ? '进行中' : '已结算'}
                  </span>
                </div>

                {/* Stake breakdown with bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-400">📈 UP {upPct}%</span>
                    <span className="text-red-400">📉 DOWN {downPct}%</span>
                  </div>
                  <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-green-500 transition-all" 
                      style={{ width: `${upPct}%` }}
                    />
                    <div 
                      className="bg-red-500 transition-all" 
                      style={{ width: `${downPct}%` }}
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-750 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">总质押</p>
                    <p className="text-lg font-bold text-yellow-400">{(market.total_stake || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">下注人数</p>
                    <p className="text-lg font-bold">{market.prediction_count || 0}</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">UP 赔率</p>
                    <p className="text-lg font-bold text-green-400">{odds.up}</p>
                    <p className="text-xs text-gray-500">{(market.up_stake || 0).toLocaleString()} / {(market.up_count || 0)}人</p>
                  </div>
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">DOWN 赔率</p>
                    <p className="text-lg font-bold text-red-400">{odds.down}</p>
                    <p className="text-xs text-gray-500">{(market.down_stake || 0).toLocaleString()} / {(market.down_count || 0)}人</p>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs">UP/DOWN 比例</p>
                    <p className="text-lg font-bold">
                      {(market.up_count || 0)}:{market.down_count || 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}