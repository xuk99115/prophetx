'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Bet {
  id: string;
  market_id: string;
  market_question: string;
  direction: 'up' | 'down';
  amount: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  market_end_time: string;
  market_result?: 'up' | 'down' | null;
}

interface Stats {
  total_bets: number;
  won: number;
  lost: number;
  pending: number;
  total_won: number;
  total_lost: number;
}

export default function MyBets() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<Stats>({ total_bets: 0, won: 0, lost: 0, pending: 0, total_won: 0, total_lost: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('http://143.198.84.94:3001/api/predictions/my', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('请先登录');
        return res.json();
      })
      .then(data => {
        setBets(data.bets || []);
        setStats(data.stats || { total_bets: 0, won: 0, lost: 0, pending: 0, total_won: 0, total_lost: 0 });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [router]);

  const getStatusBadge = (bet: Bet) => {
    if (bet.status === 'pending') {
      return <span className="bg-yellow-600 text-yellow-200 px-2 py-1 rounded text-xs">待开奖</span>;
    }
    if (bet.status === 'won') {
      return <span className="bg-green-600 text-green-200 px-2 py-1 rounded text-xs">赢了 +{bet.amount}</span>;
    }
    return <span className="bg-red-600 text-red-200 px-2 py-1 rounded text-xs">输了 -{bet.amount}</span>;
  };

  const getDirectionBadge = (direction: 'up' | 'down') => {
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        direction === 'up' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
      }`}>
        {direction === 'up' ? '↑ UP' : '↓ DOWN'}
      </span>
    );
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
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">📋 我的下注</h1>
          <p className="text-gray-400 mt-2">查看你的下注记录</p>
        </div>
        <a href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
          ← 返回首页
        </a>
      </header>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">总下注</p>
          <p className="text-2xl font-bold mt-1">{stats.total_bets}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">待开奖</p>
          <p className="text-2xl font-bold mt-1 text-yellow-400">{stats.pending}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">赢了</p>
          <p className="text-2xl font-bold mt-1 text-green-400">+{stats.total_won}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">输了</p>
          <p className="text-2xl font-bold mt-1 text-red-400">-{stats.total_lost}</p>
        </div>
      </div>

      {/* 净盈亏 */}
      <div className="bg-gray-800 rounded-xl p-4 mb-8 flex justify-between items-center">
        <span className="text-gray-400">净盈亏</span>
        <span className={`text-3xl font-bold ${stats.total_won - stats.total_lost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {stats.total_won - stats.total_lost >= 0 ? '+' : ''}{stats.total_won - stats.total_lost}
        </span>
      </div>

      {error ? (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300">
          {error}
        </div>
      ) : bets.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl text-gray-500">暂无下注记录</p>
          <p className="text-gray-600 mt-2">去首页下注吧！</p>
          <a href="/" className="inline-block mt-4 bg-cyan-600 hover:bg-cyan-500 px-6 py-2 rounded-lg">
            前往首页
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {bets.map(bet => (
            <div key={bet.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getDirectionBadge(bet.direction)}
                  {getStatusBadge(bet)}
                </div>
                <p className="text-white font-medium">{bet.market_question}</p>
                <p className="text-gray-500 text-sm mt-1">
                  下注 {bet.amount} | {new Date(bet.created_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {bet.status !== 'pending' && bet.market_result && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">市场结果</p>
                  <p className={`text-lg font-bold ${bet.market_result === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.market_result === 'up' ? '↑ UP' : '↓ DOWN'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <footer className="mt-12 text-center text-gray-600 text-sm">
        <p>Powered by Arena | OpenClaw AI Agent</p>
      </footer>
    </div>
  );
}