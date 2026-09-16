import logo from "../assets/vyastha_logo.jpeg";
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// import { Lock, Mail, Building2, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Lock, Mail, Building2, Sparkles, ArrowRight, ShieldCheck, QrCode, Package } from 'lucide-react';
import { toast } from 'sonner';
// import WelcomeNamaste from '../components/WelcomeNamaste';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, demoLogin } = useAuth();
  // const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
  try {
  await login(email, password);
  toast.success('Welcome back!');
  sessionStorage.setItem('vyastha_show_welcome', '1');
  navigate('/dashboard');
} catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid login credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    // <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-lg shadow-blue-500/30">
             <img 
              src={logo} 
              alt="Vyastha" 
              className="h-9 w-9 rounded-lg object-cover shadow-sm"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight" data-testid="login-heading">
            Vyastha
          </h1>
          <p className="text-base text-blue-300 font-bold" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
 Sab Sambhal Lega!
</p>
        </div>

         <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl shadow-blue-900/20 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  placeholder="owner@business.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-white text-slate-900 rounded-lg text-sm font-bold transition-all shadow-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            Don't have an account yet?{' '}
            <Link to="/register" data-testid="register-link" className="font-bold text-blue-400 hover:text-blue-300 underline">
              Create Business Account
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-[11px] text-slate-400 font-medium">
  <span className="flex items-center space-x-1.5">
    <ShieldCheck size={14} className="text-emerald-500" />
    <span>GST & PAN Compliant</span>
  </span>
  <span className="flex items-center space-x-1.5">
    <QrCode size={14} className="text-blue-400" />
    <span>Dynamic UPI QRs</span>
  </span>
  <span className="flex items-center space-x-1.5">
    <Package size={14} className="text-amber-400" />
    <span>Live Stock Deduction</span>
  </span>
</div>
      </div>
      {/* {showWelcome && (
        <WelcomeNamaste
          userName={user?.name || ''}
          onComplete={() => navigate('/dashboard')}
        />
      )} */}
    </div>
    
  );
}