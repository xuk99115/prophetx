'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['AI', 'Crypto', 'Sports', 'Politics', '科技', '金融', '娱乐', '其他'];

export default function CreateMarket() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('AI');
  const [endTime, setEndTime] = useState('');
  const [stake, setStake] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 获取明天的时间作为默认截止时间
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDatetime = tomorrow.toISOString().slice(0, 16);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError('请输入预测问题');
      return;
    }
    if (!endTime) {
      setError('请选择截止时间');
      return;
    }
    if (!stake || Number(stake) <= 0) {
      setError('请输入有效的质押数量');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('http://143.198.84.94:3001/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          category,
          end_time: new Date(endTime).toISOString(),
          stake: Number(stake),
        }),
      });

      if (!res.ok) {
        throw new Error('创建失败');
      }

      alert('市场创建成功！');
      router.push('/');
    } catch (err) {
      setError('创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8">
        <a href="/" className="text-gray-400 hover:text-white text-sm">← 返回首页</a>
        <h1 className="text-3xl font-bold text-cyan-400 mt-4">📈 创建预测市场</h1>
      </header>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          {/* 问题输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              预测问题
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="例如：2025年比特币会突破 100000 美元吗？"
              className="w-full bg-gray-750 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
              rows={3}
            />
          </div>

          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              分类
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-gray-750 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 截止时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              截止时间
            </label>
            <input
              type="datetime-local"
              value={endTime || defaultDatetime}
              onChange={e => setEndTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full bg-gray-750 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* 质押数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              质押积分数量
            </label>
            <input
              type="number"
              value={stake}
              onChange={e => setStake(e.target.value)}
              placeholder="最低 100 积分"
              min={100}
              step={100}
              className="w-full bg-gray-750 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-gray-500 text-xs mt-1">最低质押 100 积分，创建后不可撤回</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
          >
            {submitting ? '创建中...' : '🚀 创建市场'}
          </button>
        </div>
      </form>
    </div>
  );
}