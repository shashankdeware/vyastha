import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../lib/format';
import { Users, IndianRupee, Activity, Package, Save, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
      <div className="flex justify-between items-center text-slate-500">
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="text-2xl font-black text-slate-950 font-mono">{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    api.get('/admin/plans').then((r) => setPlans(r.data)).catch(() => {});
    api.get('/admin/audit-logs').then((r) => setLogs(r.data)).catch(() => {});
  }, [user]);

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const updatePlan = async (slug, field, value) => {
    setPlans((ps) => ps.map((p) => (p.slug === slug ? { ...p, [field]: value } : p)));
  };

  const savePlan = async (plan) => {
    setSaving(plan.slug);
    try {
      await api.put(`/admin/plans/${plan.slug}`, {
        monthly_price: Number(plan.monthly_price),
        yearly_price: Number(plan.yearly_price),
        trial_days: Number(plan.trial_days || 0),
        active: Boolean(plan.active),
      });
      toast.success(`${plan.name} updated`);
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setSaving('');
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'plans', label: 'Plans & Pricing' },
    { key: 'users', label: 'Users' },
    { key: 'logs', label: 'AI Audit Logs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="text-blue-600" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="admin-title">Admin Panel</h1>
      </div>

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} data-testid={`admin-tab-${t.key}`} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.total_users} icon={Users} color="text-blue-600" />
          <StatCard label="Active Subs" value={stats.active_subscriptions} icon={Activity} color="text-emerald-600" />
          <StatCard label="On Trial" value={stats.trialing} icon={Package} color="text-amber-600" />
          <StatCard label="Revenue" value={formatINR(stats.revenue_total)} icon={IndianRupee} color="text-blue-600" />
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          {plans.map((p) => (
            <div key={p.slug} data-testid={`admin-plan-${p.slug}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-extrabold text-slate-900">{p.name} <span className="text-xs font-mono text-slate-400">({p.slug})</span></p>
                  <p className="text-xs text-slate-500">{p.description}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input type="checkbox" data-testid={`admin-plan-active-${p.slug}`} checked={!!p.active} onChange={(e) => updatePlan(p.slug, 'active', e.target.checked)} /> Active
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400">Monthly (₹)</label>
                  <input type="number" data-testid={`admin-plan-monthly-${p.slug}`} value={p.monthly_price} onChange={(e) => updatePlan(p.slug, 'monthly_price', e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400">Yearly (₹)</label>
                  <input type="number" data-testid={`admin-plan-yearly-${p.slug}`} value={p.yearly_price} onChange={(e) => updatePlan(p.slug, 'yearly_price', e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400">Trial Days</label>
                  <input type="number" data-testid={`admin-plan-trial-${p.slug}`} value={p.trial_days || 0} onChange={(e) => updatePlan(p.slug, 'trial_days', e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                </div>
              </div>
              <button data-testid={`admin-plan-save-${p.slug}`} onClick={() => savePlan(p)} disabled={saving === p.slug} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                {saving === p.slug ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Save Changes
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-users-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><span className="text-xs font-mono">{u.role}</span></td>
                  <td className="px-4 py-3 capitalize">{u.plan_slug}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 capitalize">{u.subscription_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100" data-testid="admin-audit-logs">
          {logs.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No AI activity logged yet.</p>}
          {logs.map((l, i) => (
            <div key={i} className="px-4 py-3 flex justify-between items-center text-sm">
              <div><p className="text-slate-800">{l.question}</p><p className="text-[11px] text-slate-400">lang: {l.language} · user: {l.user_id?.slice(0, 8)}</p></div>
              <span className="text-[11px] text-slate-400 font-mono">{(l.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
