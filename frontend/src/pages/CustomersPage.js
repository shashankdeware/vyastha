import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { validateMobile, validatePAN, validateGSTIN, validateEmailFormat, toUpperTrim } from '../lib/validation';

const GST_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
];

const EMPTY_CUSTOMER = {
  company_name: '',
  contact_person: '',
  gstin_number: '',
  pan_number: '',
  phone: '',
  email: '',
  address: '',
  customer_id: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setCustomers(res.data || []);
    } catch (e) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCreate = () => {
    setEditing({ ...EMPTY_CUSTOMER });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing({ ...c });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.company_name) {
      toast.error('Company name is required');
      return;
    }

    // Normalize PAN/GSTIN to uppercase before validating & saving
    const normalized = {
      ...editing,
      pan_number: toUpperTrim(editing.pan_number),
      gstin_number: toUpperTrim(editing.gstin_number),
    };

    const validationChecks = [
      ['Mobile number', validateMobile(normalized.phone)],
      ['PAN', validatePAN(normalized.pan_number)],
      ['GSTIN', validateGSTIN(normalized.gstin_number)],
      ['Email', validateEmailFormat(normalized.email)],
    ];
    const firstError = validationChecks.find(([, msg]) => msg);
    if (firstError) {
      toast.error(`${firstError[0]}: ${firstError[1]}`);
      return;
    }

    try {
      if (normalized.id) {
        await api.put(`/customers/${normalized.id}`, normalized);
        toast.success('Customer updated successfully');
      } else {
        await api.post('/customers', normalized);
        toast.success('Customer added successfully');
      }
      setShowModal(false);
      setEditing(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save customer');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (e) {
      toast.error('Failed to delete customer');
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.gstin_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
            data-testid="customers-page-title"
          >
            Customer Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Save your regular clients with GSTIN details for one-click invoicing.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          data-testid="add-customer-btn"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Customers</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono" data-testid="stat-total-customers">
            {customers.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">GST Registered</span>
            <Building2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {customers.filter((c) => c.gstin_number).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">With Email Contact</span>
            <Mail size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600 font-mono">
            {customers.filter((c) => c.email).length}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-customers-input"
            placeholder="Search by name, GSTIN, email, phone..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <Users size={32} className="mx-auto text-slate-300" />
            <p>No customers in your directory yet.</p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-block font-bold text-blue-600 hover:underline"
            >
              Add your first customer &rarr;
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="customers-list-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Company / Contact</th>
                  <th className="py-3 px-4">GSTIN / PAN</th>
                  <th className="py-3 px-4">Phone / Email</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 transition-colors"
                    data-testid={`customer-row-${c.customer_id}`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.customer_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{c.company_name}</div>
                      {c.contact_person && (
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                          <User size={11} />
                          <span>{c.contact_person}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 text-[11px]">
                      {c.gstin_number ? (
                        <div>
                          <span className="block">{c.gstin_number}</span>
                          {c.pan_number && (
                            <span className="text-slate-400 text-[10px]">PAN: {c.pan_number}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Unregistered</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-[11px]">
                      {c.phone && (
                        <div className="flex items-center space-x-1">
                          <Phone size={11} className="text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center space-x-1 mt-0.5">
                          <Mail size={11} className="text-slate-400" />
                          <span className="text-slate-600">{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {c.address ? (
                        <div className="flex items-start space-x-1 max-w-[180px]">
                          <MapPin size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        data-testid={`edit-customer-btn-${c.customer_id}`}
                        title="Edit Customer"
                        className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.company_name)}
                        data-testid={`delete-customer-btn-${c.customer_id}`}
                        title="Delete Customer"
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

      {/* Add / Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Users size={18} className="text-blue-400" />
                <h3 className="font-bold text-base tracking-tight" data-testid="customer-modal-title">
                  {editing.id ? 'Edit Customer' : 'Add New Customer'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditing(null);
                }}
                data-testid="customer-modal-close-btn"
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.company_name}
                    onChange={(e) => setEditing({ ...editing, company_name: e.target.value })}
                    data-testid="customer-company-input"
                    placeholder="e.g. Acme Retailers Pvt Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={editing.contact_person}
                    onChange={(e) => setEditing({ ...editing, contact_person: e.target.value })}
                    data-testid="customer-contact-input"
                    placeholder="Point of contact name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Customer ID
                  </label>
                  <input
                    type="text"
                    value={editing.customer_id}
                    onChange={(e) =>
                      setEditing({ ...editing, customer_id: e.target.value.toUpperCase() })
                    }
                    data-testid="customer-id-input"
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                    disabled={Boolean(editing.id)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={editing.gstin_number}
                    onChange={(e) =>
                      setEditing({ ...editing, gstin_number: e.target.value.toUpperCase() })
                    }
                    data-testid="customer-gstin-input"
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                  />
                </div>
                                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    State (for GST)
                  </label>
                  <select
                    value={editing.state_code || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, state_code: e.target.value })
                    }
                    data-testid="customer-state-code-input"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select State</option>
                    {GST_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={editing.pan_number}
                    onChange={(e) =>
                      setEditing({ ...editing, pan_number: e.target.value.toUpperCase() })
                    }
                    data-testid="customer-pan-input"
                    placeholder="ABCDE1234F"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    data-testid="customer-phone-input"
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    data-testid="customer-email-input"
                    placeholder="contact@business.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Billing Address
                  </label>
                  <textarea
                    rows={2}
                    value={editing.address}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                    data-testid="customer-address-input"
                    placeholder="Complete address with city, state, PIN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditing(null);
                  }}
                  data-testid="customer-cancel-btn"
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="customer-save-btn"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  {editing.id ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
