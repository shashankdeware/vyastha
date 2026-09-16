import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import SignatureModal from '../components/SignatureModal';
import PDFDocumentView from '../components/PDFDocumentView';
import { 
  Save, 
  FileText, 
  Plus, 
  Trash2, 
  Eye, 
  ArrowLeft, 
  PenTool, 
  QrCode, 
  Building2, 
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

export default function InvoiceBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const refQuoteNum = searchParams.get('refQuote') || '';

  const [loading, setLoading] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  const [invoice, setInvoice] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    shipping_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    vehicle_number: '',
    reference_quotation_number: refQuoteNum,
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
    status: 'finalized',
    payment_status: 'unpaid',
    amount_paid: 0,
    auto_deduct_inventory: true
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
          setInvoice(prev => ({
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
      const loadInvoice = async () => {
        try {
          const res = await api.get(`/invoices/${id}`);
          setInvoice(res.data);
        } catch (e) {
          toast.error('Failed to load invoice details');
        }
      };
      loadInvoice();
    }
  }, [id]);

  useEffect(() => {
    const subtotal = invoice.line_items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);

    let discountAmt = 0;
    const discVal = parseFloat(invoice.discount_value) || 0;
    if (invoice.discount_type === 'percentage') {
      discountAmt = (subtotal * discVal) / 100;
    } else {
      discountAmt = discVal;
    }
    discountAmt = Math.max(0, Math.min(discountAmt, subtotal));

    const taxable = Math.max(0, subtotal - discountAmt);
    const taxRate = parseFloat(invoice.tax_rate) || 0;
    const taxAmt = (taxable * taxRate) / 100;
    const total = taxable + taxAmt;

    setInvoice(prev => ({
      ...prev,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discountAmt.toFixed(2)),
      tax_amount: parseFloat(taxAmt.toFixed(2)),
      total_amount: parseFloat(total.toFixed(2))
    }));
  }, [invoice.line_items, invoice.discount_type, invoice.discount_value, invoice.tax_rate]);

  const handleItemChange = (index, field, value) => {
    const updated = [...invoice.line_items];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'unit_price') {
      const q = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const p = parseFloat(field === 'unit_price' ? value : updated[index].unit_price) || 0;
      updated[index].amount = parseFloat((q * p).toFixed(2));
      if (field === 'quantity') {
        updated[index].pieces = q;
      }
    }

    setInvoice({ ...invoice, line_items: updated });
  };

  const handleProductSelect = (index, productId) => {
    const prod = productsList.find(p => p.id === productId);
    if (prod) {
      const updated = [...invoice.line_items];
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
      setInvoice({ ...invoice, line_items: updated });
    }
  };

  const addItemRow = () => {
    setInvoice({
      ...invoice,
      line_items: [
        ...invoice.line_items,
        { product_id: '', description: '', quantity: 1, unit: 'pc', pieces: 1, unit_price: 0, amount: 0 }
      ]
    });
  };

  const removeItemRow = (index) => {
    if (invoice.line_items.length <= 1) return;
    const updated = invoice.line_items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, line_items: updated });
  };

  const handleCustomerSelect = (custId) => {
    const c = customersList.find(item => item.id === custId || item.customer_id === custId);
    if (c) {
      setInvoice({
        ...invoice,
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

  const handleSave = async (statusType = 'finalized') => {
    if (!invoice.buyer_details.company_name) {
      toast.error('Please enter buyer / customer company name');
      return;
    }
    if (invoice.line_items.length === 0 || !invoice.line_items[0].description) {
      toast.error('Please add at least one line item description');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...invoice,
        status: statusType,
        seller_details: invoice.seller_details,
        bank_details: invoice.seller_details.bank_details || invoice.bank_details
      };

      if (id) {
        await api.put(`/invoices/${id}`, payload);
        toast.success(`Invoice ${statusType === 'draft' ? 'saved as Draft' : 'updated & finalized'}!`);
      } else {
        const res = await api.post('/invoices', payload);
        toast.success(`Invoice ${res.data.invoice_number} ${statusType === 'draft' ? 'saved as Draft' : 'created & finalized'}!`);
      }

      navigate(statusType === 'draft' ? '/drafts' : '/invoices');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const upiId = invoice.seller_details?.bank_details?.upi_id || 'business@upi';
  const dynamicUpiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(invoice.seller_details?.company_name || 'Vyastha')}&am=${invoice.total_amount}&cu=INR&tn=${encodeURIComponent(invoice.invoice_number || 'TaxInvoice')}`;

  return (
    <div className="space-y-6 pb-16 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            data-testid="back-to-invoices-btn"
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight" data-testid="invoice-builder-title">
              {id ? `Edit Invoice (${invoice.invoice_number})` : 'New Tax Invoice'}
            </h1>
            <p className="text-xs text-slate-500">
              Live calculations, dynamic UPI QR, stock sync, and PDF generation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            data-testid="preview-invoice-modal-btn"
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5"
          >
            <Eye size={14} />
            <span>Preview Document</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('draft')}
            data-testid="save-draft-invoice-btn"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            Save Draft (50/Day)
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('finalized')}
            data-testid="finalize-invoice-btn"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Save size={14} />
            <span>{loading ? 'Processing...' : 'Finalize & Save Invoice'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Building2 size={16} className="text-blue-600" />
              <span>Seller Details (Your Profile)</span>
            </h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-semibold">
              Auto-Filled Profile
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Name</label>
              <input
                type="text"
                value={invoice.seller_details.company_name}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, company_name: e.target.value }
                })}
                data-testid="seller-company-name-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Tagline</label>
              <input
                type="text"
                value={invoice.seller_details.tagline}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, tagline: e.target.value }
                })}
                data-testid="seller-tagline-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">GSTIN</label>
              <input
                type="text"
                value={invoice.seller_details.gstin_number}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, gstin_number: e.target.value.toUpperCase() }
                })}
                data-testid="seller-gstin-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">PAN</label>
              <input
                type="text"
                value={invoice.seller_details.pan_number}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, pan_number: e.target.value.toUpperCase() }
                })}
                data-testid="seller-pan-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone</label>
              <input
                type="text"
                value={invoice.seller_details.phone}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, phone: e.target.value }
                })}
                data-testid="seller-phone-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email</label>
              <input
                type="email"
                value={invoice.seller_details.email}
                onChange={(e) => setInvoice({
                  ...invoice,
                  seller_details: { ...invoice.seller_details, email: e.target.value }
                })}
                data-testid="seller-email-input"
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
                data-testid="select-saved-customer"
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
                value={invoice.buyer_details.company_name}
                onChange={(e) => setInvoice({
                  ...invoice,
                  buyer_details: { ...invoice.buyer_details, company_name: e.target.value }
                })}
                data-testid="buyer-company-name-input"
                placeholder="e.g. Apex Global Logistics"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Contact Person</label>
              <input
                type="text"
                value={invoice.buyer_details.contact_person}
                onChange={(e) => setInvoice({
                  ...invoice,
                  buyer_details: { ...invoice.buyer_details, contact_person: e.target.value }
                })}
                data-testid="buyer-contact-person-input"
                placeholder="e.g. Vikram Malhotra"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Buyer GSTIN</label>
              <input
                type="text"
                value={invoice.buyer_details.gstin_number}
                onChange={(e) => setInvoice({
                  ...invoice,
                  buyer_details: { ...invoice.buyer_details, gstin_number: e.target.value.toUpperCase() }
                })}
                data-testid="buyer-gstin-input"
                placeholder="27AABCA5544K1ZZ"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Buyer Phone</label>
              <input
                type="text"
                value={invoice.buyer_details.phone}
                onChange={(e) => setInvoice({
                  ...invoice,
                  buyer_details: { ...invoice.buyer_details, phone: e.target.value }
                })}
                data-testid="buyer-phone-input"
                placeholder="+91 98000..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Billing / Delivery Address</label>
              <input
                type="text"
                value={invoice.buyer_details.address}
                onChange={(e) => setInvoice({
                  ...invoice,
                  buyer_details: { ...invoice.buyer_details, address: e.target.value }
                })}
                data-testid="buyer-address-input"
                placeholder="Plot 45, Industrial Estate, Mumbai"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
          Invoice Identifiers & Transport Details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice #</label>
            <input
              type="text"
              value={invoice.invoice_number}
              onChange={(e) => setInvoice({ ...invoice, invoice_number: e.target.value })}
              data-testid="invoice-number-input"
              placeholder="Auto-Generated"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-slate-50 font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice Date *</label>
            <input
              type="date"
              required
              value={invoice.invoice_date}
              onChange={(e) => setInvoice({ ...invoice, invoice_date: e.target.value })}
              data-testid="invoice-date-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Shipping Date</label>
            <input
              type="date"
              value={invoice.shipping_date}
              onChange={(e) => setInvoice({ ...invoice, shipping_date: e.target.value })}
              data-testid="shipping-date-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Customer ID</label>
            <input
              type="text"
              value={invoice.customer_id}
              onChange={(e) => setInvoice({ ...invoice, customer_id: e.target.value })}
              data-testid="invoice-customer-id-input"
              placeholder="CUST-001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vehicle Number</label>
            <input
              type="text"
              value={invoice.vehicle_number}
              onChange={(e) => setInvoice({ ...invoice, vehicle_number: e.target.value.toUpperCase() })}
              data-testid="invoice-vehicle-number-input"
              placeholder="MH-04-AB-1234"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ref Quotation #</label>
            <input
              type="text"
              value={invoice.reference_quotation_number}
              onChange={(e) => setInvoice({ ...invoice, reference_quotation_number: e.target.value })}
              data-testid="ref-quotation-number-input"
              placeholder="QUO-2026-0001"
              className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 rounded-lg font-mono text-blue-700 font-bold"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Line Items & Billing Table</h2>
            <p className="text-[11px] text-slate-400">All amounts and totals update automatically in real time.</p>
          </div>
          <button
            type="button"
            onClick={addItemRow}
            data-testid="add-line-item-btn"
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="line-items-builder-table">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Description / Inventory Item</th>
                <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                <th className="py-2.5 px-3 w-24 text-center">Unit</th>
                <th className="py-2.5 px-3 w-24 text-right">Pieces (pc)</th>
                <th className="py-2.5 px-3 w-32 text-right">Unit Price (₹)</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.line_items.map((item, idx) => (
                <tr key={idx} className="group">
                  <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3 space-y-1">
                    <input
                      type="text"
                      required
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      data-testid={`item-desc-input-${idx}`}
                      placeholder="Item name / specification"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
                    />
                    {productsList.length > 0 && (
                      <select
                        value={item.product_id || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        data-testid={`select-product-item-${idx}`}
                        className="text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 w-full"
                      >
                        <option value="">-- Or Select from Stock Inventory --</option>
                        {productsList.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (₹{p.unit_price} / Stock: {p.stock_quantity})</option>
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
                      data-testid={`item-qty-input-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono font-semibold"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      data-testid={`item-unit-input-${idx}`}
                      placeholder="pc / kg"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-mono"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={item.pieces}
                      onChange={(e) => handleItemChange(idx, 'pieces', e.target.value)}
                      data-testid={`item-pieces-input-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono text-slate-600"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      data-testid={`item-price-input-${idx}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono font-semibold"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900" data-testid={`item-amount-display-${idx}`}>
                    ₹{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {invoice.line_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        data-testid={`remove-item-btn-${idx}`}
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

        <div className="flex flex-col sm:flex-row justify-between items-start pt-4 border-t border-slate-200 gap-6">
          <div className="space-y-3 max-w-sm">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={invoice.auto_deduct_inventory}
                onChange={(e) => setInvoice({ ...invoice, auto_deduct_inventory: e.target.checked })}
                data-testid="auto-deduct-inventory-checkbox"
                className="h-4 w-4 text-blue-600 rounded border-slate-300"
              />
              <span>Automatically deduct product inventory stock on finalization</span>
            </label>
          </div>

          <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-bold text-slate-900" data-testid="invoice-subtotal-display">
                ₹{invoice.subtotal.toFixed(2)}
              </span>
            </div>

            <div className="py-1 border-t border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Discount:</span>
                <div className="flex items-center space-x-1">
                  <select
                    value={invoice.discount_type}
                    onChange={(e) => setInvoice({ ...invoice, discount_type: e.target.value })}
                    data-testid="discount-type-select"
                    className="border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                  >
                    <option value="amount">Fixed (₹)</option>
                    <option value="percentage">Percent (%)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={invoice.discount_value}
                    onChange={(e) => setInvoice({ ...invoice, discount_value: parseFloat(e.target.value) || 0 })}
                    data-testid="discount-value-input"
                    className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-right font-mono"
                  />
                </div>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount Applied:</span>
                  <span className="font-mono">-₹{invoice.discount_amount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-200/60">
              <span className="text-slate-600">Tax / GST Rate (%):</span>
              <select
                value={invoice.tax_rate}
                onChange={(e) => setInvoice({ ...invoice, tax_rate: parseFloat(e.target.value) || 0 })}
                data-testid="tax-rate-select"
                className="border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold"
              >
                <option value="0">0% (Exempt)</option>
                <option value="5">5% (Essential)</option>
                <option value="12">12% (Standard 1)</option>
                <option value="18">18% (Standard 2 - Default)</option>
                <option value="28">28% (Luxury)</option>
              </select>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-600">Tax Amount:</span>
              <span className="font-mono font-bold text-slate-900" data-testid="tax-amount-display">
                ₹{invoice.tax_amount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between py-2.5 bg-slate-900 text-white px-3 rounded-lg text-sm font-bold mt-2">
              <span>Grand Total:</span>
              <span className="font-mono text-base text-blue-400" data-testid="invoice-grand-total-display">
                ₹{invoice.total_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
            <QrCode size={16} className="text-blue-600" />
            <span>Payment QR & Settlement Details</span>
          </h2>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-4">
            <div className="bg-white p-2.5 border rounded-lg shadow-sm flex flex-col items-center">
              <QRCodeSVG value={dynamicUpiUrl} size={90} level="M" />
              <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase">Dynamic QR</span>
            </div>
            <div className="text-xs space-y-1 overflow-hidden">
              <p className="font-bold text-slate-900">Live Exact-Amount QR Code</p>
              <p className="text-slate-500 text-[11px]">Encoded Amount: <strong className="font-mono text-blue-600">₹{invoice.total_amount}</strong></p>
              <p className="text-slate-500 text-[11px] font-mono truncate">UPI ID: {upiId}</p>
              <p className="text-[10px] text-slate-400">Customer scans with any UPI app to pay exact total.</p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice Notes / Memo</label>
            <textarea
              rows={2}
              value={invoice.notes}
              onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
              data-testid="invoice-notes-input"
              placeholder="e.g. Dispatched via SafeXpress tracking #88192..."
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
              data-testid="open-signature-modal-btn"
              className="text-xs text-blue-600 hover:underline font-bold flex items-center space-x-1"
            >
              <PenTool size={13} />
              <span>{invoice.signature_url ? 'Change Signature' : 'Draw / Add Signature'}</span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              value={invoice.terms_and_conditions}
              onChange={(e) => setInvoice({ ...invoice, terms_and_conditions: e.target.value })}
              data-testid="invoice-terms-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="text-xs">
              <p className="font-bold text-slate-800">Authorized Signature</p>
              <p className="text-[11px] text-slate-500">Will be stamped on official PDF exports.</p>
            </div>
            {invoice.signature_url ? (
              <img 
                src={invoice.signature_url} 
                alt="Signature preview" 
                className="max-h-12 object-contain bg-white p-1 border rounded"
              />
            ) : (
              <span className="text-xs text-slate-400 italic">No signature attached</span>
            )}
          </div>
        </div>
      </div>

      <SignatureModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        currentSignature={invoice.signature_url}
        onSave={(sigData) => setInvoice({ ...invoice, signature_url: sigData })}
      />

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-100 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-900 text-sm">Invoice PDF Preview</span>
              <button
                onClick={() => setShowPreviewModal(false)}
                data-testid="close-builder-preview-btn"
                className="p-2 bg-white rounded-full text-slate-600 hover:text-slate-900 shadow"
              >
                &times;
              </button>
            </div>
            <PDFDocumentView documentData={invoice} type="INVOICE" />
          </div>
        </div>
      )}
    </div>
  );
}