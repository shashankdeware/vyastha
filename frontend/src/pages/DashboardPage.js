import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { 
  TrendingUp, 
  CreditCard, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import WelcomeNamaste from '../components/WelcomeNamaste';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const { user } = useAuth();

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (e) {
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
  fetchDashboard();
}, []);

useEffect(() => {
  if (sessionStorage.getItem('vyastha_show_welcome')) {
    setShowWelcome(true);
    sessionStorage.removeItem('vyastha_show_welcome');
  }
}, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-slate-500 font-medium">
        Loading workspace analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="dashboard-title">
            Business Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time financial performance, billing status, and inventory metrics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/invoices/new"
            data-testid="dashboard-create-invoice-btn"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </Link>
          <Link
            to="/quotations/new"
            data-testid="dashboard-create-quote-btn"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>New Quotation</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Invoiced</span>
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono" data-testid="stat-total-revenue">
            ₹{stats?.total_revenue?.toLocaleString('en-IN') || '0.00'}
          </div>
          <p className="text-[11px] text-slate-400">Lifetime billed across all clients</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Collections</span>
            <CreditCard size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono" data-testid="stat-today-collected">
            ₹{stats?.today_collected?.toLocaleString('en-IN') || '0.00'}
          </div>
          <p className="text-[11px] text-slate-400">Total payments cleared today</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding Balance</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono" data-testid="stat-total-outstanding">
            ₹{stats?.total_outstanding?.toLocaleString('en-IN') || '0.00'}
          </div>
          <p className="text-[11px] text-slate-400">{stats?.unpaid_invoices_count || 0} unpaid / pending bills</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Daily Drafts Used</span>
            <span className="text-xs font-mono font-bold text-slate-700" data-testid="stat-drafts-count">
              {stats?.today_drafts_count || 0}/50
            </span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {50 - (stats?.today_drafts_count || 0)} Drafts Left
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full"
              style={{ width: `${Math.min(100, ((stats?.today_drafts_count || 0) / 50) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <FileText size={18} className="text-blue-600" />
              <span>Recent Invoices</span>
            </h3>
            <Link to="/invoices" data-testid="view-all-invoices-link" className="text-xs font-bold text-blue-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          {stats?.recent_invoices?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {stats.recent_invoices.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inv.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </div>
                    <p className="text-slate-500 truncate max-w-[200px]">{inv.buyer_details?.company_name || 'Client'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">₹{inv.total_amount?.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400">{inv.invoice_date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No invoices generated yet. Click "Create Invoice" to start!
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <CreditCard size={18} className="text-emerald-600" />
              <span>Recent Payment Transactions</span>
            </h3>
            <Link to="/payments" data-testid="view-all-payments-link" className="text-xs font-bold text-blue-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          {stats?.recent_payments?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {stats.recent_payments.map((p) => (
                <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">{p.invoice_number || 'Direct Pay'}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono">
                        {p.payment_method}
                      </span>
                    </div>
                    <p className="text-slate-500 truncate max-w-[200px]">{p.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-600">+₹{p.amount?.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.transaction_ref}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No payment transactions recorded yet.
            </div>
          )}
        </div>
      </div>
      {showWelcome && (
        <WelcomeNamaste
          userName={user?.name || ''}
          onComplete={() => setShowWelcome(false)}
        />
      )}
    </div>
  );
}