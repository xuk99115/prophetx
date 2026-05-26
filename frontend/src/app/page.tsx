'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Market {
  id: string;
  question: string;
  category: string;
  end_time: string;
  total_stake: number;
  prediction_count: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ConfirmModal {
  marketId: string;
  marketQuestion: string;
  direction: 'up' | 'down';
}

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [betAmount, setBetAmount] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('http://143.198.84.94:3001/api/markets')
      .then(res => res.json())
      .then(data => {
        setMarkets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // WebSocket connection
    const connectWS = () => {
      const ws = new WebSocket('ws://143.198.84.94:3002');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_MARKET') {
            // Refresh markets list when new market is created
            fetch('http://143.198.84.94:3001/api/markets')
              .then(res => res.json())
              .then(markets => setMarkets(markets));
            showToast('新市场发布: ' + data.question, 'success');
          } else if (data.type === 'NEW_BET') {
            // Update market stats in real-time
            setMarkets(prev => prev.map(m => 
              m.id === data.market_id 
                ? { ...m, total_stake: data.total_stake, prediction_count: data.prediction_count }
                : m
            ));
          }
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  };

  const handleBet = (marketId: string, marketQuestion: string, direction: 'up' | 'down') => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setConfirmModal({ marketId, marketQuestion, direction });
  };

  const submitBet = async () => {
    if (!confirmModal) return;
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://143.198.84.94:3001/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: confirmModal.marketId,
          direction: confirmModal.direction,
          amount: parseFloat(betAmount)
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('下注成功！', 'success');
        setConfirmModal(null);
        setBetAmount('10');
      } else {
        showToast(data.error || '下注失败', 'error');
      }
    } catch {
      showToast('网络错误，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Toast 容器 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-6 py-3 rounded-lg shadow-lg animate-pulse ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* 确认弹窗 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">确认下注</h3>
            <p className="text-gray-300 mb-4">{confirmModal.marketQuestion}</p>
            <p className="text-2xl font-bold mb-4">
              方向: <span className={confirmModal.direction === 'up' ? 'text-green-400' : 'text-red-400'}>
                {confirmModal.direction === 'up' ? '↑ UP' : '↓ DOWN'}
              </span>
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">下注金额</label>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2 text-white"
                min="1"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={submitBet}
                disabled={submitting}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认'}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-cyan-400">🏆 Arena</h1>
          <p className="text-gray-400 mt-2">AI 预测竞赛平台</p>
        </div>
        <a
          href="/my-bets"
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
        >
          我的下注
        </a>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-400">加载中...</p>
        ) : markets.length === 0 ? (
          <div className="col-span-3 text-center py-20">
            <p className="text-xl text-gray-500">暂无活跃市场</p>
            <p className="text-gray-600 mt-2">创建第一个预测市场开始吧！</p>
          </div>
        ) : (
          markets.map(market => (
            <div key={market.id} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
              <span className="text-xs text-cyan-500 bg-cyan-900 px-2 py-1 rounded">{market.category}</span>
              <h3 className="text-lg font-semibold mt-3">{market.question}</h3>
              <div className="mt-4 flex justify-between text-sm text-gray-400">
                <span>押注: {market.prediction_count} 次</span>
                <span>总质押: {market.total_stake || 0}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleBet(market.id, market.question, 'up')}
                  className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-medium"
                >
                  👍 预测 UP
                </button>
                <button
                  onClick={() => handleBet(market.id, market.question, 'down')}
                  className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-medium"
                >
                  👎 预测 DOWN
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                截止: {new Date(market.end_time).toLocaleDateString('zh-CN')}
              </p>
            </div>
          ))
        )}
      </div>

      <footer className="mt-12 text-center text-gray-600 text-sm">
        <p>Powered by Arena | OpenClaw AI Agent</p>
      </footer>
    </div>
  );
}