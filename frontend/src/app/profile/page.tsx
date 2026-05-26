'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BetStats {
  total_bets: number;
  total_wins: number;
  total_staked: number;
  win_rate: number;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function Profile() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('用户');
  const [points, setPoints] = useState(0);
  const [stats, setStats] = useState<BetStats>({ total_bets: 0, total_wins: 0, total_staked: 0, win_rate: 0 });
  const [showTopup, setShowTopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recharging, setRecharging] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('user_id');
    const storedUsername = localStorage.getItem('username');

    if (!token || !storedUserId) {
      router.push('/login');
      return;
    }

    setUserId(storedUserId);
    setUsername(storedUsername || '用户');

    // Fetch profile data
    fetch(`/api/users/${storedUserId}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.balance !== undefined) {
          setPoints(data.balance);
        }
        if (data.stats) {
          setStats({
            total_bets: data.stats.total_predictions || 0,
            total_wins: data.stats.won_count || 0,
            total_staked: data.stats.total_staked || 0,
            win_rate: data.stats.accuracy || 0
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  const topupOptions = [
    { amount: 100, price: '¥6' },
    { amount: 500, price: '¥28' },
    { amount: 1000, price: '¥50' },
    { amount: 5000, price: '¥220' },
  ];

  const handleTopup = async (amount: number) => {
    if (!userId) return;

    setRecharging(amount);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/users/${userId}/recharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      const data = await res.json();

      if (res.ok) {
        setPoints(p => p + amount);
        setShowTopup(false);
        showToast(`充值成功！+${amount} 积分已到账`, 'success');
      } else {
        showToast(data.error || '充值失败', 'error');
      }
    } catch (err) {
      showToast('充值失败，请稍后重试', 'error');
    } finally {
      setRecharging(null);
    }
  };

  const handleLogout = () => {
    if (confirm('确定退出登录？')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      router.push('/');
    }
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
      {/* Toast 提示 */}
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      <header className="mb-8">
        <a href="/" className="text-gray-400 hover:text-white text-sm">← 返回首页</a>
        <h1 className="text-3xl font-bold text-cyan-400 mt-4">👤 用户面板</h1>
      </header>

      {/* 用户信息卡片 */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-cyan-600 flex items-center justify-center text-2xl">
            {username[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{username}</h2>
            <p className="text-gray-400 text-sm">ID: {userId?.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-750 rounded-lg p-4">
          <div>
            <p className="text-gray-400 text-sm">积分余额</p>
            <p className="text-3xl font-bold text-yellow-400">{points.toLocaleString()}</p>
          </div>
          <button
            onClick={() => setShowTopup(!showTopup)}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-lg"
          >
            💰 充值积分
          </button>
        </div>

        {/* 充值选项 */}
        {showTopup && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {topupOptions.map(opt => (
              <button
                key={opt.amount}
                onClick={() => handleTopup(opt.amount)}
                disabled={recharging !== null}
                className="bg-gray-750 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 text-center transition disabled:opacity-50"
              >
                {recharging === opt.amount ? (
                  <p className="text-lg font-bold">充值中...</p>
                ) : (
                  <>
                    <p className="text-lg font-bold">{opt.amount} 积分</p>
                    <p className="text-yellow-400 text-sm">{opt.price}</p>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 历史下注统计 */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">📊 历史下注统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-750 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">总下注次数</p>
            <p className="text-2xl font-bold">{stats.total_bets}</p>
          </div>
          <div className="bg-gray-750 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">获胜次数</p>
            <p className="text-2xl font-bold text-green-400">{stats.total_wins}</p>
          </div>
          <div className="bg-gray-750 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">总质押积分</p>
            <p className="text-2xl font-bold">{stats.total_staked.toLocaleString()}</p>
          </div>
          <div className="bg-gray-750 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">胜率</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.win_rate}%</p>
          </div>
        </div>
      </div>

      {/* 快捷链接 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <a href="/history" className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center transition">
          <h4 className="text-lg font-semibold">📜 历史市场</h4>
          <p className="text-gray-400 text-sm mt-1">查看已结算的市场</p>
        </a>
        <a href="/stats" className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center transition">
          <h4 className="text-lg font-semibold">📊 市场统计</h4>
          <p className="text-gray-400 text-sm mt-1">查看所有市场数据</p>
        </a>
      </div>

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-lg transition"
      >
        🚪 退出登录
      </button>
    </div>
  );
}