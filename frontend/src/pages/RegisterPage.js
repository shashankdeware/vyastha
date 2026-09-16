import logo from "../assets/vyastha_logo.jpeg";
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Building2, User, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company_name: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData);
      toast.success('Account created! Welcome to Vyastha.');
      navigate('/onboarding');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to register account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4 relative font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-lg shadow-blue-500/30">
                       <img 
                        src={logo} 
                        alt="Vyastha" 
                        className="h-9 w-9 rounded-lg object-cover shadow-sm"
                      />
                    </div>
          <h1 className="text-2xl font-black text-white tracking-tight" data-testid="register-heading">
            Register Your Business
          </h1>
          <p className="text-xs text-slate-400">
            Start issuing professional invoices and tracking inventory in seconds.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl shadow-blue-900/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Your Name *
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  data-testid="register-name-input"
                  placeholder="Full Name"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Company / Business Name *
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  data-testid="register-company-input"
                  placeholder="e.g. Acme Global Logistics"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  data-testid="register-email-input"
                  placeholder="work@biz.com"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
               <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
  Phone Number <span className="text-transparent">*</span>
</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  data-testid="register-phone-input"
                  placeholder="+91 98000..."
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  data-testid="register-password-input"
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all shadow-md"
            >
              {loading ? 'Creating Account...' : 'Create Account & Setup'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" data-testid="login-link" className="font-bold text-blue-400 hover:text-blue-300 underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}