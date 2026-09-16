import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import PDFDocumentView from '../components/PDFDocumentView';
import PaymentRecordModal from '../components/PaymentRecordModal';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  CreditCard, 
  Trash2, 
  Eye, 
  Edit3,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data);
    } catch (e) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDelete = async (id, invNum) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invNum}?`)) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success(`Invoice ${invNum} deleted`);
      fetchInvoices();
    } catch (e) {
      toast.error('Failed to delete invoice');
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.buyer_details?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.buyer_details?.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'PAID') return matchesSearch && inv.payment_status === 'paid';
    if (statusFilter === 'UNPAID') return matchesSearch && inv.payment_status !== 'paid';
    if (statusFilter === 'DRAFT') return matchesSearch && inv.status === 'draft';
    return matchesSearch && inv.status === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="invoices-page-title">
            Invoices
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage, generate, download PDF, and collect payments for all business invoices.
          </p>
        </div>
        <Link
          to="/invoices/new"
          data-testid="create-new-invoice-btn"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Create New Invoice</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-invoices-input"
            placeholder="Search by Invoice # or Customer..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {['ALL', 'FINALIZED', 'PAID', 'UNPAID', 'DRAFT'].map((st) => (
            <button
              key={st}
              type="button"
              data-testid={`filter-status-${st.toLowerCase()}`}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                statusFilter === st 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <FileText size={32} className="mx-auto text-slate-300" />
            <p>No invoices found matching your criteria.</p>
            <Link to="/invoices/new" className="inline-block font-bold text-blue-600 hover:underline">
              Create your first invoice &rarr;
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="invoices-list-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Balance (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`invoice-row-${inv.invoice_number}`}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {inv.invoice_number}
                      {inv.reference_quotation_number && (
                        <span className="block text-[10px] text-blue-600 font-sans font-normal">
                          Ref: {inv.reference_quotation_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{inv.invoice_date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {inv.buyer_details?.company_name || 'Customer'}
                      {inv.buyer_details?.contact_person && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {inv.buyer_details.contact_person}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                      ₹{inv.total_amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-600">
                      ₹{(inv.balance_due ?? inv.total_amount)?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'draft' ? 'bg-slate-200 text-slate-800' :
                        inv.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        inv.payment_status === 'partially_paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        data-testid={`preview-invoice-btn-${inv.invoice_number}`}
                        title="Preview & Download PDF"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Eye size={16} />
                      </button>

                      {inv.payment_status !== 'paid' && inv.status !== 'draft' && (
                        <button
                          type="button"
                          onClick={() => setPayingInvoice(inv)}
                          data-testid={`pay-invoice-btn-${inv.invoice_number}`}
                          title="Record Payment"
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                        >
                          <CreditCard size={16} />
                        </button>
                      )}

                      {inv.status === 'draft' && (
                        <Link
                          to={`/invoices/edit/${inv.id}`}
                          data-testid={`edit-invoice-btn-${inv.invoice_number}`}
                          className="inline-block p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <Edit3 size={16} />
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id, inv.invoice_number)}
                        data-testid={`delete-invoice-btn-${inv.invoice_number}`}
                        title="Delete Invoice"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-100 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-900 text-sm">Invoice PDF Preview</span>
              <button
                onClick={() => setPreviewInvoice(null)}
                data-testid="close-pdf-preview-btn"
                className="p-2 bg-white rounded-full text-slate-600 hover:text-slate-900 shadow"
              >
                <X size={18} />
              </button>
            </div>
            <PDFDocumentView documentData={previewInvoice} type="INVOICE" />
          </div>
        </div>
      )}

      {payingInvoice && (
        <PaymentRecordModal
          isOpen={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          invoice={payingInvoice}
          onPaymentSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}