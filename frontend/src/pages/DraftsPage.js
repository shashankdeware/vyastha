import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { 
  Clock, 
  FileText, 
  FileSpreadsheet, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function DraftsPage() {
  const [stats, setStats] = useState({
    today_drafts_count: 0,
    max_daily_limit: 50,
    remaining_drafts_today: 50,
    invoice_drafts: [],
    quotation_drafts: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' or 'quotations'

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/drafts/stats');
      setStats(res.data);
    } catch (e) {
      toast.error('Failed to load drafts quota & records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDeleteInvoiceDraft = async (id, invNum) => {
    if (!window.confirm(`Delete draft ${invNum}?`)) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Draft deleted');
      fetchDrafts();
    } catch (e) {
      toast.error('Failed to delete draft');
    }
  };

  const handleDeleteQuotationDraft = async (id, quoNum) => {
    if (!window.confirm(`Delete quotation draft ${quoNum}?`)) return;
    try {
      await api.delete(`/quotations/${id}`);
      toast.success('Quotation draft deleted');
      fetchDrafts();
    } catch (e) {
      toast.error('Failed to delete quotation draft');
    }
  };

  const usagePercent = Math.min(100, ((stats.today_drafts_count || 0) / (stats.max_daily_limit || 50)) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="drafts-page-title">
            Drafts & Daily Limit Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Draft invoices and quotations automatically saved. Maximum 50 drafts per day allowed.
          </p>
        </div>
      </div>

      {/* 50 Drafts/Day Quota Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Today's Draft Storage Limit</h3>
              <p className="text-xs text-slate-500">Resets daily at midnight UTC.</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black font-mono text-blue-600" data-testid="draft-count-metric">
              {stats.today_drafts_count || 0}
            </span>
            <span className="text-sm font-bold text-slate-400 font-mono"> / 50 drafts today</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.max(4, usagePercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{stats.remaining_drafts_today} remaining draft slots today</span>
            <span>Max 50 Drafts/Day Policy</span>
          </div>
        </div>

        {stats.today_drafts_count >= 50 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span>Daily draft limit reached. Please finalize existing drafts or delete old ones to save new drafts.</span>
          </div>
        )}
      </div>

      {/* Drafts Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            data-testid="tab-draft-invoices"
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all flex items-center space-x-2 ${
              activeTab === 'invoices'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText size={15} />
            <span>Invoice Drafts ({stats.invoice_drafts?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotations')}
            data-testid="tab-draft-quotations"
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all flex items-center space-x-2 ${
              activeTab === 'quotations'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>Quotation Drafts ({stats.quotation_drafts?.length || 0})</span>
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading drafts...</div>
          ) : activeTab === 'invoices' ? (
            stats.invoice_drafts?.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Clock size={32} className="mx-auto text-slate-300" />
                <p>No active invoice drafts.</p>
                <Link to="/invoices/new" className="text-blue-600 font-bold hover:underline">
                  Create Invoice &rarr;
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.invoice_drafts.map((inv) => (
                  <div key={inv.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs" data-testid={`draft-inv-row-${inv.invoice_number}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase">Draft</span>
                      </div>
                      <p className="text-slate-500">{inv.buyer_details?.company_name || 'Customer'}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="font-mono font-bold text-slate-900">₹{inv.total_amount?.toLocaleString('en-IN')}</span>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/invoices/edit/${inv.id}`}
                          data-testid={`resume-draft-inv-btn-${inv.invoice_number}`}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center space-x-1"
                        >
                          <Edit3 size={13} />
                          <span>Resume & Edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoiceDraft(inv.id, inv.invoice_number)}
                          data-testid={`delete-draft-inv-btn-${inv.invoice_number}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            stats.quotation_drafts?.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Clock size={32} className="mx-auto text-slate-300" />
                <p>No active quotation drafts.</p>
                <Link to="/quotations/new" className="text-blue-600 font-bold hover:underline">
                  Create Quotation &rarr;
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.quotation_drafts.map((quo) => (
                  <div key={quo.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs" data-testid={`draft-quo-row-${quo.quotation_number}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{quo.quotation_number}</span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase">Draft</span>
                      </div>
                      <p className="text-slate-500">{quo.buyer_details?.company_name || 'Customer'}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="font-mono font-bold text-slate-900">₹{quo.total_amount?.toLocaleString('en-IN')}</span>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/quotations/edit/${quo.id}`}
                          data-testid={`resume-draft-quo-btn-${quo.quotation_number}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center space-x-1"
                        >
                          <Edit3 size={13} />
                          <span>Resume & Edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuotationDraft(quo.id, quo.quotation_number)}
                          data-testid={`delete-draft-quo-btn-${quo.quotation_number}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}