import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import SignatureModal from '../components/SignatureModal';
import PDFDocumentView from '../components/PDFDocumentView';
import { 
  Save, 
  Plus, 
  Trash2, 
  Eye, 
  ArrowLeft, 
  PenTool, 
  Building2, 
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

export default function QuotationBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  const [quotation, setQuotation] = useState({
    quotation_number: '',
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    customer_id: '',
    vehicle_number: '',
    seller_details: {
      company_name: '',
      pan_number: '',
      gstin_number: '',
      phone: '',
      email: '',
      company_logo: '',
      tagline: '',
      address: '',
      bank_details: {
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        ifsc: '',
        branch: '',
        upi_id: ''
      },
      default_terms: ''
    },
    buyer_details: {
      company_name: '',
      contact_person: '',
      gstin_number: '',
      pan_number: '',
      phone: '',
      email: '',
      address: '',
      customer_id: ''
    },
    line_items: [
      { product_id: '', description: '', quantity: 1, unit: 'pc', pieces: 1, unit_price: 0, amount: 0 }
    ],
    subtotal: 0,
    tax_rate: 18,
    tax_amount: 0,
    discount_type: 'amount',
    discount_value: 0,
    discount_amount: 0,
    total_amount: 0,
    terms_and_conditions: '',
    bank_details: {},
    signature_url: '',
    notes: '',
    status: 'sent'
  });

  useEffect(() => {
    const initData = async () => {
      try {
        const [profRes, custRes, prodRes] = await Promise.all([
          api.get('/company-profile'),
          api.get('/customers'),
          api.get('/products')
        ]);

        setCustomersList(custRes.data);
        setProductsList(prodRes.data);

        if (!id) {
          setQuotation(prev => ({
            ...prev,
            seller_details: profRes.data,
            bank_details: profRes.data.bank_details || {},
            terms_and_conditions: profRes.data.default_terms || '',
            signature_url: profRes.data.signature_image || ''
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    initData();
  }, [id]);

  useEffect(() => {
    if (id) {
      const loadQuote = async () => {
        try {
          const res = await api.get(`/quotations/${id}`);
          setQuotation(res.data);
        } catch (e) {
          toast.error('Failed to load quotation');
        }
      };
      loadQuote();
    }
  }, [id]);

  useEffect(() => {
    const subtotal = quotation.line_items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);

    let discountAmt = 0;
    const discVal = parseFloat(quotation.discount_value) || 0;
    if (quotation.discount_type === 'percentage') {
      discountAmt = (subtotal * discVal) / 100;
    } else {
      discountAmt = discVal;
    }
    discountAmt = Math.max(0, Math.min(discountAmt, subtotal));

    const taxable = Math.max(0, subtotal - discountAmt);
    const taxRate = parseFloat(quotation.tax_rate) || 0;
    const taxAmt = (taxable * taxRate) / 100;
    const total = taxable + taxAmt;

    setQuotation(prev => ({
      ...prev,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discountAmt.toFixed(2)),
      tax_amount: parseFloat(taxAmt.toFixed(2)),
      total_amount: parseFloat(total.toFixed(2))
    }));
  }, [quotation.line_items, quotation.discount_type, quotation.discount_value, quotation.tax_rate]);

  const handleItemChange = (index, field, value) => {
    const updated = [...quotation.line_items];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'unit_price') {
      const q = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const p = parseFloat(field === 'unit_price' ? value : updated[index].unit_price) || 0;
      updated[index].amount = parseFloat((q * p).toFixed(2));
      if (field === 'quantity') {
        updated[index].pieces = q;
      }
    }

    setQuotation({ ...quotation, line_items: updated });
  };

  const handleProductSelect = (index, productId) => {
    const prod = productsList.find(p => p.id === productId);
    if (prod) {
      const updated = [...quotation.line_items];
      updated[index] = {
        ...updated[index],
        product_id: prod.id,
        description: prod.name,
        unit: prod.unit || 'pc',
        unit_price: prod.unit_price || 0,
        quantity: updated[index].quantity || 1,
        pieces: updated[index].pieces || 1,
        amount: (updated[index].quantity || 1) * (prod.unit_price || 0)
      };
      setQuotation({ ...quotation, line_items: updated });
    }
  };

  const addItemRow = () => {
    setQuotation({
      ...quotation,
      line_items: [
        ...quotation.line_items,
        { product_id: '', description: '', quantity: 1, unit: 'pc', pieces: 1, unit_price: 0, amount: 0 }
      ]
    });
  };

  const removeItemRow = (index) => {
    if (quotation.line_items.length <= 1) return;
    const updated = quotation.line_items.filter((_, i) => i !== index);
    setQuotation({ ...quotation, line_items: updated });
  };

  const handleCustomerSelect = (custId) => {
    const c = customersList.find(item => item.id === custId || item.customer_id === custId);
    if (c) {
      setQuotation({
        ...quotation,
        customer_id: c.customer_id,
        buyer_details: {
          company_name: c.company_name,
          contact_person: c.contact_person,
          gstin_number: c.gstin_number,
          pan_number: c.pan_number,
          phone: c.phone,
          email: c.email,
          address: c.address,
          customer_id: c.customer_id
        }
      });
    }
  };

  const handleSave = async (statusType = 'sent') => {
    if (!quotation.buyer_details.company_name) {
      toast.error('Please enter buyer / customer company name');
      return;
    }
    if (quotation.line_items.length === 0 || !quotation.line_items[0].description) {
      toast.error('Please add at least one line item description');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...quotation,
        status: statusType,
        seller_details: quotation.seller_details,
        bank_details: quotation.seller_details.bank_details || quotation.bank_details
      };

      if (id) {
        await api.put(`/quotations/${id}`, payload);
        toast.success(`Quotation ${statusType === 'draft' ? 'saved as Draft' : 'updated'}!`);
      } else {
        const res = await api.post('/quotations', payload);
        toast.success(`Quotation ${res.data.quotation_number} ${statusType === 'draft' ? 'saved as Draft' : 'created'}!`);
      }

      navigate(statusType === 'draft' ? '/drafts' : '/quotations');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  const upiId = quotation.seller_details?.bank_details?.upi_id || 'business@upi';
  const dynamicUpiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(quotation.seller_details?.company_name || 'Vyastha')}&am=${quotation.total_amount}&cu=INR&tn=${encodeURIComponent(quotation.quotation_number || 'Quote')}`;

  return (
    <div className="space-y-6 pb-16 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            data-testid="back-to-quotations-btn"
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight" data-testid="quotation-builder-title">
              {id ? `Edit Quotation (${quotation.quotation_number})` : 'New Price Quotation'}
            </h1>
            <p className="text-xs text-slate-500">
              Exact same layout and calculation logic as invoices, with 1-click invoice conversion.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            data-testid="preview-quotation-modal-btn"
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5"
          >
            <Eye size={14} />
            <span>Preview Document</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('draft')}
            data-testid="save-draft-quote-btn"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            Save Draft (50/Day)
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('sent')}
            data-testid="save-quote-btn"
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Save size={14} />
            <span>{loading ? 'Processing...' : 'Save & Send Quotation'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Building2 size={16} className="text-blue-600" />
              <span>Seller Details</span>
            </h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-semibold">
              Reusable Profile
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Name</label>
              <input
                type="text"
                value={quotation.seller_details.company_name}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, company_name: e.target.value }
                })}
                data-testid="quote-seller-company-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Tagline</label>
              <input
                type="text"
                value={quotation.seller_details.tagline}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, tagline: e.target.value }
                })}
                data-testid="quote-seller-tagline-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">GSTIN</label>
              <input
                type="text"
                value={quotation.seller_details.gstin_number}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, gstin_number: e.target.value.toUpperCase() }
                })}
                data-testid="quote-seller-gstin-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">PAN</label>
              <input
                type="text"
                value={quotation.seller_details.pan_number}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, pan_number: e.target.value.toUpperCase() }
                })}
                data-testid="quote-seller-pan-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone</label>
              <input
                type="text"
                value={quotation.seller_details.phone}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, phone: e.target.value }
                })}
                data-testid="quote-seller-phone-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email</label>
              <input
                type="email"
                value={quotation.seller_details.email}
                onChange={(e) => setQuotation({
                  ...quotation,
                  seller_details: { ...quotation.seller_details, email: e.target.value }
                })}
                data-testid="quote-seller-email-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <User size={16} className="text-emerald-600" />
              <span>Buyer / Customer Details</span>
            </h2>

            {customersList.length > 0 && (
              <select
                onChange={(e) => handleCustomerSelect(e.target.value)}
                data-testid="select-saved-customer-quote"
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-slate-50 text-slate-700"
              >
                <option value="">-- Load Saved Customer --</option>
                {customersList.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} ({c.customer_id})</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Customer Company *</label>
              <input
                type="text"
                required
                value={quotation.buyer_details.company_name}
                onChange={(e) => setQuotation({
                  ...quotation,
                  buyer_details: { ...quotation.buyer_details, company_name: e.target.value }
                })}
                data-testid="quote-buyer-company-input"
                placeholder="e.g. Apex Global Logistics"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Contact Person</label>
              <input
                type="text"
                value={quotation.buyer_details.contact_person}
                onChange={(e) => setQuotation({
                  ...quotation,
                  buyer_details: { ...quotation.buyer_details, contact_person: e.target.value }
                })}
                data-testid="quote-buyer-contact-input"
                placeholder="e.g. Vikram Malhotra"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Buyer GSTIN</label>
              <input
                type="text"
                value={quotation.buyer_details.gstin_number}
                onChange={(e) => setQuotation({
                  ...quotation,
                  buyer_details: { ...quotation.buyer_details, gstin_number: e.target.value.toUpperCase() }
                })}
                data-testid="quote-buyer-gstin-input"
                placeholder="27AABCA5544K1ZZ"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Buyer Phone</label>
              <input
                type="text"
                value={quotation.buyer_details.phone}
                onChange={(e) => setQuotation({
                  ...quotation,
                  buyer_details: { ...quotation.buyer_details, phone: e.target.value }
                })}
                data-testid="quote-buyer-phone-input"
                placeholder="+91 98000..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Address</label>
              <input
                type="text"
                value={quotation.buyer_details.address}
                onChange={(e) => setQuotation({
                  ...quotation,
                  buyer_details: { ...quotation.buyer_details, address: e.target.value }
                })}
                data-testid="quote-buyer-address-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
          Quotation Meta & Validity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quotation #</label>
            <input
              type="text"
              value={quotation.quotation_number}
              onChange={(e) => setQuotation({ ...quotation, quotation_number: e.target.value })}
              data-testid="quote-number-input"
              placeholder="Auto-Generated"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-slate-50 font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quotation Date *</label>
            <input
              type="date"
              required
              value={quotation.quotation_date}
              onChange={(e) => setQuotation({ ...quotation, quotation_date: e.target.value })}
              data-testid="quote-date-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Valid Until</label>
            <input
              type="date"
              value={quotation.valid_until}
              onChange={(e) => setQuotation({ ...quotation, valid_until: e.target.value })}
              data-testid="quote-valid-until-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vehicle / Note</label>
            <input
              type="text"
              value={quotation.vehicle_number}
              onChange={(e) => setQuotation({ ...quotation, vehicle_number: e.target.value })}
              data-testid="quote-vehicle-input"
              placeholder="Optional"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="font-bold text-sm text-slate-900">Quotation Line Items</h2>
          <button
            type="button"
            onClick={addItemRow}
            data-testid="add-quote-item-btn"
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center space-x-1.5"
          >
            <Plus size={14} />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="quote-items-table">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Description</th>
                <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                <th className="py-2.5 px-3 w-24 text-center">Unit</th>
                <th className="py-2.5 px-3 w-24 text-right">Pieces (pc)</th>
                <th className="py-2.5 px-3 w-32 text-right">Unit Price (₹)</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.line_items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3 space-y-1">
                    <input
                      type="text"
                      required
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      data-testid={`quote-item-desc-${idx}`}
                      placeholder="Item name / specification"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
                    />
                    {productsList.length > 0 && (
                      <select
                        value={item.product_id || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 w-full"
                      >
                        <option value="">-- Or Select from Stock Inventory --</option>
                        {productsList.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (₹{p.unit_price})</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      data-testid={`quote-item-qty-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono font-semibold"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      data-testid={`quote-item-unit-${idx}`}
                      placeholder="pc"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-mono"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={item.pieces}
                      onChange={(e) => handleItemChange(idx, 'pieces', e.target.value)}
                      data-testid={`quote-item-pieces-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      data-testid={`quote-item-price-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono font-semibold"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900" data-testid={`quote-item-amount-${idx}`}>
                    ₹{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {quotation.line_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        data-testid={`remove-quote-item-btn-${idx}`}
                        className="text-slate-300 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">₹{quotation.subtotal.toFixed(2)}</span>
            </div>
            <div className="py-1 border-t border-slate-200/60 flex justify-between items-center">
              <span className="text-slate-600">Discount:</span>
              <div className="flex items-center space-x-1">
                <select
                  value={quotation.discount_type}
                  onChange={(e) => setQuotation({ ...quotation, discount_type: e.target.value })}
                  className="border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                >
                  <option value="amount">Fixed (₹)</option>
                  <option value="percentage">Percent (%)</option>
                </select>
                <input
                  type="number"
                  value={quotation.discount_value}
                  onChange={(e) => setQuotation({ ...quotation, discount_value: parseFloat(e.target.value) || 0 })}
                  className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-right font-mono"
                />
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-200/60">
              <span className="text-slate-600">GST (%):</span>
              <select
                value={quotation.tax_rate}
                onChange={(e) => setQuotation({ ...quotation, tax_rate: parseFloat(e.target.value) || 0 })}
                className="border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Tax Amount:</span>
              <span className="font-mono font-bold text-slate-900">₹{quotation.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-slate-900 text-white px-3 rounded-lg text-sm font-bold mt-2">
              <span>Total Quote:</span>
              <span className="font-mono text-base text-blue-400" data-testid="quote-grand-total-display">
                ₹{quotation.total_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
            Quotation Notes & QR
          </h2>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-4">
            <div className="bg-white p-2 border rounded-lg flex flex-col items-center">
              <QRCodeSVG value={dynamicUpiUrl} size={80} level="M" />
              <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase">Dynamic QR</span>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">Dynamic Payment QR</p>
              <p className="text-slate-500 font-mono text-[11px]">Quote Value: ₹{quotation.total_amount}</p>
              <p className="text-slate-400 text-[10px]">Embedded in PDF for instant customer acceptance deposit.</p>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Notes</label>
            <textarea
              rows={2}
              value={quotation.notes}
              onChange={(e) => setQuotation({ ...quotation, notes: e.target.value })}
              data-testid="quote-notes-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900">Terms & Authorized Signatory</h2>
            <button
              type="button"
              onClick={() => setShowSigModal(true)}
              data-testid="open-quote-signature-modal-btn"
              className="text-xs text-blue-600 hover:underline font-bold flex items-center space-x-1"
            >
              <PenTool size={13} />
              <span>{quotation.signature_url ? 'Change Signature' : 'Add Signature'}</span>
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quotation Terms</label>
            <textarea
              rows={3}
              value={quotation.terms_and_conditions}
              onChange={(e) => setQuotation({ ...quotation, terms_and_conditions: e.target.value })}
              data-testid="quote-terms-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>
          {quotation.signature_url && (
            <img src={quotation.signature_url} alt="Signature" className="max-h-12 object-contain bg-white p-1 border rounded" />
          )}
        </div>
      </div>

      <SignatureModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        currentSignature={quotation.signature_url}
        onSave={(sigData) => setQuotation({ ...quotation, signature_url: sigData })}
      />

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-100 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-900 text-sm">Quotation PDF Preview</span>
              <button
                onClick={() => setShowPreviewModal(false)}
                data-testid="close-quote-builder-preview-btn"
                className="p-2 bg-white rounded-full text-slate-600 hover:text-slate-900 shadow"
              >
                &times;
              </button>
            </div>
            <PDFDocumentView documentData={quotation} type="QUOTATION" />
          </div>
        </div>
      )}
    </div>
  );
}