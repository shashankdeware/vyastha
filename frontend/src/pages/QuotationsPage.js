import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import PDFDocumentView from '../components/PDFDocumentView';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  ArrowRightLeft, 
  Trash2, 
  Eye, 
  Edit3, 
  X 
} from 'lucide-react';
import { toast } from 'sonner';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const [convertingId, setConvertingId] = useState(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations');
      setQuotations(res.data);
    } catch (e) {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleConvertToInvoice = async (quo) => {
    if (!window.confirm(`Convert Quotation ${quo.quotation_number} into a formal Tax Invoice?`)) return;
    setConvertingId(quo.id);
    try {
      const res = await api.post(`/quotations/${quo.id}/convert-to-invoice`);
      toast.success(res.data.message || 'Quotation converted to Invoice successfully!');
      navigate('/invoices');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to convert quotation');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async (id, quoNum) => {
    if (!window.confirm(`Delete quotation ${quoNum}?`)) return;
    try {
      await api.delete(`/quotations/${id}`);
      toast.success(`Quotation ${quoNum} deleted`);
      fetchQuotations();
    } catch (e) {
      toast.error('Failed to delete quotation');
    }
  };

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = 
      q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.buyer_details?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.buyer_details?.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && q.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="quotations-page-title">
            Quotations & Estimates
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Create price estimates, generate PDFs, and convert them to invoices with 1-click.
          </p>
        </div>
        <Link
          to="/quotations/new"
          data-testid="create-new-quote-btn"
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Create New Quotation</span>
        </Link>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-quotations-input"
            placeholder="Search by Quote # or Customer..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {['ALL', 'SENT', 'ACCEPTED', 'CONVERTED', 'DRAFT'].map((st) => (
            <button
              key={st}
              type="button"
              data-testid={`filter-quote-${st.toLowerCase()}`}
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
          <div className="py-16 text-center text-slate-500 text-xs">Loading quotations...</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <FileSpreadsheet size={32} className="mx-auto text-slate-300" />
            <p>No quotations found.</p>
            <Link to="/quotations/new" className="inline-block font-bold text-blue-600 hover:underline">
              Create your first quotation &rarr;
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="quotations-list-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Quote Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((quo) => (
                  <tr key={quo.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`quotation-row-${quo.quotation_number}`}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {quo.quotation_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{quo.quotation_date}</td>
                    <td className="py-3 px-4 text-slate-600">{quo.valid_until || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {quo.buyer_details?.company_name || 'Customer'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                      ₹{quo.total_amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        quo.status === 'converted' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                        quo.status === 'accepted' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        quo.status === 'sent' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-slate-200 text-slate-800'
                      }`}>
                        {quo.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {quo.status !== 'converted' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToInvoice(quo)}
                          disabled={convertingId === quo.id}
                          data-testid={`convert-quote-btn-${quo.quotation_number}`}
                          title="Convert to Formal Tax Invoice"
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-[11px] inline-flex items-center space-x-1"
                        >
                          <ArrowRightLeft size={13} />
                          <span>{convertingId === quo.id ? 'Converting...' : 'Convert to Invoice'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewQuotation(quo)}
                        data-testid={`preview-quote-btn-${quo.quotation_number}`}
                        title="Preview & Download PDF"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Eye size={16} />
                      </button>
                      {quo.status === 'draft' && (
                        <Link
                          to={`/quotations/edit/${quo.id}`}
                          data-testid={`edit-quote-btn-${quo.quotation_number}`}
                          className="inline-block p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <Edit3 size={16} />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(quo.id, quo.quotation_number)}
                        data-testid={`delete-quote-btn-${quo.quotation_number}`}
                        title="Delete Quotation"
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
      {previewQuotation && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-100 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-900 text-sm">Quotation PDF Preview</span>
              <button
                onClick={() => setPreviewQuotation(null)}
                data-testid="close-quote-preview-btn"
                className="p-2 bg-white rounded-full text-slate-600 hover:text-slate-900 shadow"
              >
                <X size={18} />
              </button>
            </div>
            <PDFDocumentView documentData={previewQuotation} type="QUOTATION" />
          </div>
        </div>
      )}
    </div>
  );
}