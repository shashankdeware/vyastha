import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useEntitlements } from '../context/EntitlementContext';
import { formatINR } from '../lib/format';
import { Check, Sparkles, Crown, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [cycle, setCycle] = useState('yearly');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState('');
  const { subscription, plan, days_left, is_trial, entitlements, gateway_configured, refresh } = useEntitlements();

  useEffect(() => {
    api.get('/plans').then((r) => setPlans(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const upgrade = async (slug) => {
    if (!gateway_configured) { toast.error('Payment gateway abhi configure nahi hai'); return; }
    setCheckingOut(slug);
    try {
      const res = await api.post('/subscription/checkout', {
        plan_slug: slug, billing_cycle: cycle, origin_url: window.location.origin,
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout shuru nahi ho paaya');
      setCheckingOut('');
    }
  };

  const cancel = async () => {
    if (!window.confirm('Kya aap subscription cancel karna chahte hain? Current period ke end tak access rahega.')) return;
    try {
      await api.post('/subscription/cancel');
      toast.success('Subscription period end par cancel ho jaayegi');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cancel nahi ho paaya');
    }
  };

  if (loading) return <div className="py-20 text-center text-slate-500">Loading plans...</div>;

  const currentSlug = entitlements?.plan_slug;
  const status = entitlements?.status;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="subscription-title">Subscription & Plans</h1>
        <p className="text-sm text-slate-500">Manage your Vyastha plan, billing and features.</p>
      </div>

      {/* Current status */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="current-plan-card">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center"><Crown size={22} /></div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-blue-300 font-bold">Current Plan</p>
            <p className="text-xl font-extrabold">{plan?.name || 'Free'}{is_trial ? ' · Free Trial' : ''}</p>
            <p className="text-xs text-slate-300 capitalize">Status: {status}{days_left != null ? ` · ${days_left} din baaki` : ''}</p>
          </div>
        </div>
        {(status === 'active' || status === 'trialing') && currentSlug === 'pro' && (
          <button data-testid="cancel-subscription-btn" onClick={cancel} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200">
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-full p-1">
          <button data-testid="cycle-monthly" onClick={() => setCycle('monthly')} className={`px-5 py-2 rounded-full text-sm font-bold transition ${cycle === 'monthly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Monthly</button>
          <button data-testid="cycle-yearly" onClick={() => setCycle('yearly')} className={`px-5 py-2 rounded-full text-sm font-bold transition ${cycle === 'yearly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            Yearly <span className="text-emerald-600 text-[11px]">Save more</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {plans.map((p) => {
          const price = cycle === 'yearly' ? p.yearly_price : p.monthly_price;
          const isCurrent = currentSlug === p.slug && (status === 'active' || status === 'trialing');
          const isPaid = p.slug !== 'free' && price > 0;
          return (
            <div key={p.slug} data-testid={`plan-card-${p.slug}`} className={`bg-white rounded-2xl border p-6 space-y-4 relative ${p.highlight ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200 shadow-sm'}`}>
              {p.highlight && <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full flex items-center gap-1"><Sparkles size={12} /> Most Popular</span>}
              <div>
                <p className="text-lg font-extrabold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500 h-8">{p.description}</p>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-slate-950 font-mono" data-testid={`plan-price-${p.slug}`}>{formatINR(price)}</span>
                <span className="text-sm text-slate-400 mb-1">/{cycle === 'yearly' ? 'year' : 'month'}</span>
              </div>
              {p.trial_days > 0 && !isCurrent && (
                <p className="text-xs text-emerald-600 font-semibold">{p.trial_days}-day free trial included</p>
              )}
              <ul className="space-y-2 pt-2">
                {(p.feature_list || []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 text-sm font-bold">Current Plan</button>
              ) : isPaid ? (
                <button data-testid={`upgrade-btn-${p.slug}`} onClick={() => upgrade(p.slug)} disabled={checkingOut === p.slug} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2">
                  {checkingOut === p.slug ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  Upgrade to {p.name}
                </button>
              ) : (
                <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-bold">Free Plan</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-emerald-500" /> Secure payments · Prices in INR · Cancel anytime
      </div>
      {!gateway_configured && (
        <p className="text-center text-xs text-amber-600">Payment gateway setup pending — checkout temporarily unavailable.</p>
      )}
    </div>
  );
}
