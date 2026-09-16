import React, { useState, useEffect } from 'react';
import api from '../api/client';
import PaymentRecordModal from '../components/PaymentRecordModal';
import { 
  CreditCard, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  DollarSign, 
  Filter,
  ArrowDownLeft,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentsPage() {
  const [paymentsData, setPaymentsData] = useState({ payments: [], total_amount: 0, count: 0, filter: 'today' });
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('today'); // 'today' or 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchPayments = async (filter = filterMode) => {
    setLoading(true);
    try {
      const res = await api.get(`/payments?filter=${filter}`);
      setPaymentsData(res.data);
    } catch (e) {
      toast.error('Failed to load payments history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(filterMode);
  }, [filterMode]);

  const filteredPayments = (paymentsData.payments || []).filter(p => {
    return (
      p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.transaction_ref?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="payments-page-title">
            Payment History & Settlements
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track instant UPI settlements, bank transfers, and record incoming collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          data-testid="record-payment-btn"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Record Direct Payment</span>
        </button>
      </div>

      {/* Metrics & Filter Switch */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              {filterMode === 'today' ? "Today's Total Collections" : 'Lifetime Collections'}
            </span>
            <ArrowDownLeft size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono" data-testid="payments-total-display">
            ₹{(paymentsData.total_amount || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {paymentsData.count || 0} transaction(s) recorded
          </p>
        </div>

        {/* Filter Toggle Mode */}
        <div className="sm:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Filter View</span>
            <span className="text-[11px] text-slate-400">By default shows today's transactions</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="filter-payments-today-btn"
              onClick={() => setFilterMode('today')}
              className={`py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                filterMode === 'today'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar size={14} />
              <span>Today's Transactions</span>
            </button>
            <button
              type="button"
              data-testid="filter-payments-all-btn"
              onClick={() => setFilterMode('all')}
              className={`py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter size={14} />
              <span>Complete History (All)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-payments-input"
            placeholder="Search by invoice #, customer, UTR ref..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">Loading payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <CreditCard size={32} className="mx-auto text-slate-300" />
            <p>No payment transactions found for this period.</p>
            {filterMode === 'today' && (
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="text-blue-600 font-bold hover:underline"
              >
                View complete past history &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="payments-list-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice Ref</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Transaction / UTR #</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`payment-row-${p.transaction_ref}`}>
                    <td className="py-3 px-4 text-slate-600 font-medium">{p.payment_date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.invoice_number || 'Direct Payment'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.customer_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-semibold">
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.transaction_ref || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                      +₹{p.amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <PaymentRecordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onPaymentSuccess={() => fetchPayments(filterMode)}
      />
    </div>
  );
}