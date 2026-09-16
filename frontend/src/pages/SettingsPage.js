import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import SignatureModal from '../components/SignatureModal';
import {
  Building2,
  Save,
  Upload,
  CreditCard,
  FileText,
  Settings as SettingsIcon,
  Signature,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { validateMobile, validatePAN, validateGSTIN, validatePincode, validateEmailFormat, toUpperTrim } from '../lib/validation';

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

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('company'); // company | bank | branding | terms
  const [showSigModal, setShowSigModal] = useState(false);
  const logoInputRef = useRef(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/company-profile');
      setProfile({
        ...res.data,
        bank_details: res.data.bank_details || {
          bank_name: '',
          account_holder_name: '',
          account_number: '',
          ifsc: '',
          branch: '',
          upi_id: '',
        },
      });
    } catch (e) {
      toast.error('Failed to load company profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleBankChange = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      bank_details: { ...prev.bank_details, [field]: value },
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, company_logo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const normalized = {
      ...profile,
      pan_number: toUpperTrim(profile.pan_number),
      gstin_number: toUpperTrim(profile.gstin_number),
    };

    const validationChecks = [
      ['Phone number', validateMobile(normalized.phone)],
      ['PAN', validatePAN(normalized.pan_number)],
      ['GSTIN', validateGSTIN(normalized.gstin_number)],
      ['Email', validateEmailFormat(normalized.email)],
    ];
    const firstError = validationChecks.find(([, msg]) => msg);
    if (firstError) {
      toast.error(`${firstError[0]}: ${firstError[1]}`);
      return;
    }

    setSaving(true);
    try {
      await api.put('/company-profile', normalized);
      setProfile(normalized);
      toast.success('Business settings saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="py-20 flex justify-center text-slate-500 font-medium">
        Loading company settings...
      </div>
    );
  }

  const tabs = [
    { key: 'company', label: 'Company Details', icon: Building2 },
    { key: 'bank', label: 'Bank & UPI QR', icon: CreditCard },
    { key: 'branding', label: 'Logo & Signature', icon: ImageIcon },
    { key: 'terms', label: 'Terms & Prefixes', icon: FileText },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
            data-testid="settings-page-title"
          >
            Company Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage seller details, GST, banking, invoice branding and default terms.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          data-testid="settings-save-btn"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          {saving ? (
            <>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              data-testid={`settings-tab-${t.key}`}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Company Details */}
      {tab === 'company' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
            <Building2 size={16} className="text-blue-600" />
            <span>Seller Company Details</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={profile.company_name || ''}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                data-testid="settings-company-name-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={profile.tagline || ''}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                data-testid="settings-tagline-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                GSTIN Number
              </label>
              <input
                type="text"
                value={profile.gstin_number || ''}
                onChange={(e) =>
                  setProfile({ ...profile, gstin_number: e.target.value.toUpperCase() })
                }
                data-testid="settings-gstin-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                State (for GST)
              </label>
              <select
                value={profile.state_code || ''}
                onChange={(e) => setProfile({ ...profile, state_code: e.target.value })}
                data-testid="settings-state-code-input"
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
                value={profile.pan_number || ''}
                onChange={(e) =>
                  setProfile({ ...profile, pan_number: e.target.value.toUpperCase() })
                }
                data-testid="settings-pan-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                data-testid="settings-phone-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                data-testid="settings-email-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Registered Address
              </label>
              <textarea
                rows={2}
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                data-testid="settings-address-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bank Details */}
      {tab === 'bank' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
            <CreditCard size={16} className="text-emerald-600" />
            <span>Bank & UPI Payment Details</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            These details appear on every invoice. UPI ID powers the dynamic payment QR code auto-generated for each invoice amount.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={profile.bank_details.bank_name || ''}
                onChange={(e) => handleBankChange('bank_name', e.target.value)}
                data-testid="settings-bank-name-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={profile.bank_details.account_holder_name || ''}
                onChange={(e) => handleBankChange('account_holder_name', e.target.value)}
                data-testid="settings-account-holder-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={profile.bank_details.account_number || ''}
                onChange={(e) => handleBankChange('account_number', e.target.value)}
                data-testid="settings-account-number-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={profile.bank_details.ifsc || ''}
                onChange={(e) => handleBankChange('ifsc', e.target.value.toUpperCase())}
                data-testid="settings-ifsc-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={profile.bank_details.branch || ''}
                onChange={(e) => handleBankChange('branch', e.target.value)}
                data-testid="settings-branch-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                UPI ID (VPA) — Powers Dynamic QR *
              </label>
              <input
                type="text"
                value={profile.bank_details.upi_id || ''}
                onChange={(e) => handleBankChange('upi_id', e.target.value)}
                data-testid="settings-upi-input"
                placeholder="mycompany@okhdfcbank"
                className="w-full px-3 py-2 border border-blue-400 bg-blue-50/30 rounded-lg text-sm font-mono font-semibold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Branding */}
      {tab === 'branding' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
            <ImageIcon size={16} className="text-indigo-600" />
            <span>Logo & Signature</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Company Logo
              </label>
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center h-48 space-y-3">
                {profile.company_logo ? (
                  <img
                    src={profile.company_logo}
                    alt="Company Logo"
                    className="max-h-24 max-w-full object-contain"
                    data-testid="company-logo-preview"
                  />
                ) : (
                  <div className="text-slate-400 text-xs text-center">
                    <ImageIcon size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No logo uploaded yet</p>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="logo-file-input"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    data-testid="upload-logo-btn"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <Upload size={12} />
                    <span>Upload Logo</span>
                  </button>
                  {profile.company_logo && (
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, company_logo: '' })}
                      data-testid="remove-logo-btn"
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">PNG, JPG under 2 MB recommended</p>
              </div>
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Signature (for Invoices & Quotations)
              </label>
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center h-48 space-y-3">
                {profile.signature_image ? (
                  <img
                    src={profile.signature_image}
                    alt="Signature"
                    className="max-h-24 max-w-full object-contain"
                    data-testid="signature-preview"
                  />
                ) : (
                  <div className="text-slate-400 text-xs text-center">
                    <Signature size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No signature saved yet</p>
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowSigModal(true)}
                    data-testid="draw-signature-btn"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5"
                  >
                    <Signature size={12} />
                    <span>Draw / Upload Signature</span>
                  </button>
                  {profile.signature_image && (
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, signature_image: '' })}
                      data-testid="remove-signature-btn"
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Prefixes */}
      {tab === 'terms' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
            <FileText size={16} className="text-amber-600" />
            <span>Default Terms & Numbering Prefixes</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={profile.invoice_prefix || 'INV'}
                onChange={(e) =>
                  setProfile({ ...profile, invoice_prefix: e.target.value.toUpperCase() })
                }
                data-testid="settings-invoice-prefix-input"
                placeholder="e.g. INV / TAX / BILL"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Quotation Number Prefix
              </label>
              <input
                type="text"
                value={profile.quotation_prefix || 'QUO'}
                onChange={(e) =>
                  setProfile({ ...profile, quotation_prefix: e.target.value.toUpperCase() })
                }
                data-testid="settings-quote-prefix-input"
                placeholder="e.g. QUO / QT"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Default Terms & Conditions
            </label>
            <textarea
              rows={8}
              value={profile.default_terms || ''}
              onChange={(e) => setProfile({ ...profile, default_terms: e.target.value })}
              data-testid="settings-terms-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              placeholder="1. Payment is due within 15 days of invoice date.&#10;2. Goods once sold will not be returned."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              These terms will be pre-filled on every new invoice / quotation.
            </p>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        currentSignature={profile.signature_image}
        onSave={(dataUrl) => {
          setProfile((prev) => ({ ...prev, signature_image: dataUrl }));
        }}
      />
    </div>
  );
}
