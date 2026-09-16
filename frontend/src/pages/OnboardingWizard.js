import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Building2, CreditCard, FileCheck2, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    company_name: '',
    pan_number: '',
    gstin_number: '',
    phone: '',
    email: '',
    tagline: 'Reliable Enterprise Supplies & Services',
    address: '',
    company_logo: '',
    bank_details: {
      bank_name: 'HDFC Bank',
      account_holder_name: '',
      account_number: '',
      ifsc: '',
      branch: 'Main Branch',
      upi_id: ''
    },
    default_terms: '1. Payment is due within 15 days of invoice date.\n2. Goods once sold will not be returned.\n3. All disputes subject to local jurisdiction.'
  });

  useEffect(() => {
    const loadExisting = async () => {
      try {
        const res = await api.get('/company-profile');
        if (res.data) {
          setProfile(prev => ({
            ...prev,
            ...res.data,
            bank_details: {
              ...prev.bank_details,
              ...(res.data.bank_details || {})
            }
          }));
        }
      } catch (e) {
        // continue
      }
    };
    loadExisting();
  }, []);

  const handleBankChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      bank_details: {
        ...prev.bank_details,
        [field]: value
      }
    }));
  };

  const handleSaveAndProceed = async (nextStep) => {
    setLoading(true);
    try {
      await api.put('/company-profile', profile);
      if (nextStep) {
        setStep(nextStep);
      } else {
        toast.success("Business profile configured successfully!");
        navigate('/dashboard');
      }
    } catch (e) {
      toast.error("Failed to save profile details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-950 text-white p-6 border-b border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">Step {step} of 3</span>
              <h2 className="text-xl font-bold tracking-tight text-white" data-testid="wizard-step-title">
                {step === 1 && '1. Seller Company Details'}
                {step === 2 && '2. Bank & UPI QR Payment Setup'}
                {step === 3 && '3. Invoicing Terms & Branding'}
              </h2>
            </div>
            <div className="flex space-x-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2.5 w-8 rounded-full transition-all ${step >= s ? 'bg-blue-600' : 'bg-slate-700'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  data-testid="wizard-company-name-input"
                  placeholder="e.g. Apex Engineering Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Company Tagline</label>
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  data-testid="wizard-tagline-input"
                  placeholder="e.g. Excellence in Quality"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={profile.gstin_number}
                  onChange={(e) => setProfile({ ...profile, gstin_number: e.target.value.toUpperCase() })}
                  data-testid="wizard-gstin-input"
                  placeholder="27ABCDE1234F1Z5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">PAN Number</label>
                <input
                  type="text"
                  value={profile.pan_number}
                  onChange={(e) => setProfile({ ...profile, pan_number: e.target.value.toUpperCase() })}
                  data-testid="wizard-pan-input"
                  placeholder="ABCDE1234F"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  data-testid="wizard-phone-input"
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  data-testid="wizard-email-input"
                  placeholder="billing@company.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Registered Business Address</label>
              <textarea
                rows={2}
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                data-testid="wizard-address-input"
                placeholder="Full address, City, State, PIN"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveAndProceed(2)}
                data-testid="wizard-step1-next-btn"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm"
              >
                <span>Next: Bank & UPI QR</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-500">
              These details are printed on every invoice along with a real-time auto-generated UPI payment QR code.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={profile.bank_details.bank_name}
                  onChange={(e) => handleBankChange('bank_name', e.target.value)}
                  data-testid="wizard-bank-name-input"
                  placeholder="e.g. HDFC Bank / SBI"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={profile.bank_details.account_holder_name}
                  onChange={(e) => handleBankChange('account_holder_name', e.target.value)}
                  data-testid="wizard-account-holder-input"
                  placeholder="Company or Owner Name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={profile.bank_details.account_number}
                  onChange={(e) => handleBankChange('account_number', e.target.value)}
                  data-testid="wizard-account-number-input"
                  placeholder="50200012345678"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={profile.bank_details.ifsc}
                  onChange={(e) => handleBankChange('ifsc', e.target.value.toUpperCase())}
                  data-testid="wizard-ifsc-input"
                  placeholder="HDFC0000240"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  UPI ID (VPA for Dynamic QR Code) *
                </label>
                <input
                  type="text"
                  value={profile.bank_details.upi_id}
                  onChange={(e) => handleBankChange('upi_id', e.target.value)}
                  data-testid="wizard-upi-input"
                  placeholder="e.g. mycompany@okhdfcbank or 9876543210@paytm"
                  className="w-full px-3 py-2 border border-blue-400 bg-blue-50/30 rounded-lg text-sm font-mono font-semibold"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndProceed(3)}
                data-testid="wizard-step2-next-btn"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm"
              >
                <span>Next: Terms & Launch</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Default Terms & Conditions</label>
              <textarea
                rows={4}
                value={profile.default_terms}
                onChange={(e) => setProfile({ ...profile, default_terms: e.target.value })}
                data-testid="wizard-terms-input"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3">
              <Check className="text-emerald-600 flex-shrink-0" size={24} />
              <div className="text-xs text-emerald-900">
                <strong>Setup Complete!</strong> You are ready to generate tax invoices, manage stock inventory, and collect real-time UPI payments.
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSaveAndProceed(null)}
                data-testid="wizard-finish-btn"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-md"
              >
                <Check size={16} />
                <span>Complete & Open Workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}