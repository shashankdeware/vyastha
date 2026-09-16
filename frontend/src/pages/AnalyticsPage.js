import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useEntitlements } from '../context/EntitlementContext';
import { formatINR, formatINRShort } from '../lib/format';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, IndianRupee, Lock, Loader2 } from 'lucide-react';

const COLORS = ['#16A34A', '#CA8A04', '#DC2626', '#2563EB'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const { hasFeature } = useEntitlements();

  useEffect(() => {
    api.get('/analytics/overview')
      .then((r) => setData(r.data))
      .catch((e) => { if (e.response?.status === 402) setLocked(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>;

  if (locked || !hasFeature('advanced_analytics')) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center"><Lock className="text-blue-600" size={28} /></div>
        <h1 className="text-2xl font-extrabold text-slate-900">Advanced Analytics</h1>
        <p className="text-slate-500">Sales aur payments ke visual trends dekhने ke liye Vyastha Pro par upgrade karein.</p>
        <Link to="/subscription" data-testid="analytics-upgrade-btn" className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">View Plans</Link>
      </div>
    );
  }

  const t = data?.totals || {};
  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="analytics-title">Business Analytics</h1>
        <p className="text-sm text-slate-500">Sales aur payment trends — last 6 months.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: formatINR(t.total_sales), color: 'text-blue-600' },
          { label: 'Collected', value: formatINR(t.total_collected), color: 'text-emerald-600' },
          { label: 'Outstanding', value: formatINR(t.outstanding), color: 'text-amber-600' },
          { label: 'Invoices', value: t.invoice_count || 0, color: 'text-slate-900' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={`text-xl font-black font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Sales vs Collections</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.monthly}>
            <defs>
              <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
              <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v) => formatINR(v)} />
            <Legend />
            <Area type="monotone" dataKey="sales" name="Sales" stroke="#2563EB" fill="url(#gS)" strokeWidth={2} />
            <Area type="monotone" dataKey="collected" name="Collected" stroke="#16A34A" fill="url(#gC)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.top_products} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Invoice Payment Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.payment_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {data.payment_breakdown.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
