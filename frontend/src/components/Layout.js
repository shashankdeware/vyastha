import logo from "../assets/vyastha_logo.jpeg";
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementContext';
import AskVyastha from './AskVyastha';
import api from '../api/client';
import { 
  LayoutDashboard, 
  FileText, 
  FileSpreadsheet, 
  Clock, 
  CreditCard, 
  Boxes, 
  Users, 
  Settings, 
  LogOut, 
  AlertTriangle, 
  Building2, 
  Sparkles,
  Crown,
  Shield,
  Menu,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { subscription, days_left, is_trial, entitlements } = useEntitlements();
  const location = useLocation();
  const [draftStats, setDraftStats] = useState({ today_drafts_count: 0, max_daily_limit: 50 });
  const [lowStockCount, setLowStockCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchQuickStats = async () => {
    try {
      const [draftRes, alertRes] = await Promise.all([
        api.get('/drafts/stats'),
        api.get('/inventory/alerts')
      ]);
      setDraftStats(draftRes.data);
      setLowStockCount(alertRes.data.count || 0);
    } catch (e) {
      // ignore in background
    }
  };

  useEffect(() => {
    fetchQuickStats();
    const interval = setInterval(fetchQuickStats, 15000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // const handleSeedDemo = async () => {
  //   setSeeding(true);
  //   try {
  //     await api.post('/seed/demo-data');
  //     toast.success("Realistic demo data loaded successfully!");
  //     fetchQuickStats();
  //     window.location.reload();
  //   } catch (err) {
  //     toast.error("Failed to load demo data");
  //   } finally {
  //     setSeeding(false);
  //   }
  // };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, testId: 'nav-dashboard-link' },
    { name: 'Invoices', path: '/invoices', icon: FileText, testId: 'nav-invoices-link' },
    { name: 'Quotations', path: '/quotations', icon: FileSpreadsheet, testId: 'nav-quotations-link' },
    { 
      name: 'Drafts', 
      path: '/drafts', 
      icon: Clock, 
      testId: 'nav-drafts-link',
      badge: `${draftStats.today_drafts_count || 0}/50`
    },
    { name: 'Payments', path: '/payments', icon: CreditCard, testId: 'nav-payments-link' },
    { 
      name: 'Inventory', 
      path: '/inventory', 
      icon: Boxes, 
      testId: 'nav-inventory-link',
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300'
    },
    { name: 'Customers', path: '/customers', icon: Users, testId: 'nav-customers-link' },
    { name: 'Subscription', path: '/subscription', icon: Crown, testId: 'nav-subscription-link' },
    { name: 'Company Settings', path: '/settings', icon: Settings, testId: 'nav-settings-link' },
  ];
  if (user?.role === 'admin') {
    navLinks.push({ name: 'Admin Panel', path: '/admin', icon: Shield, testId: 'nav-admin-link' });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Mobile Top Navbar */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <img 
  src={logo} 
  alt="Vyastha" 
  className="h-9 w-9 rounded-lg object-cover shadow-sm"
/>
</div>



              <div>
                <span className="font-extrabold text-lg tracking-tight text-white block leading-none">Vyastha</span>
        </div>
        <button 
          data-testid="mobile-menu-toggle-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-md text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar for Desktop / Mobile Drawer */}
      <aside className={`
        ${mobileMenuOpen ? 'block' : 'hidden'} 
        md:block md:w-64 bg-slate-900 text-slate-200 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-30
      `}>
        <div>
          {/* Brand Header */}
          <div className="hidden md:flex items-center justify-between p-5 border-b border-slate-800">
            <Link to="/dashboard" className="flex items-center space-x-3">
              {/* <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl text-white shadow-sm">
                V
              </div> */}
              <img 
  src={logo} 
  alt="Vyastha" 
  className="h-9 w-9 rounded-lg object-cover shadow-sm"
/>



              <div>
                <span className="font-extrabold text-lg tracking-tight text-white block leading-none">Vyastha</span>
                <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest">Billing & Stock</span>
              </div>
            </Link>
          </div>

          {/* Active Company Quick Info */}
          <div className="p-4 mx-3 my-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                <Building2 size={18} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate" data-testid="sidebar-company-name">
                  {user?.company_name || 'My Enterprise'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Daily Drafts Quota Progress */}
          <div className="mx-3 mb-4 px-3 py-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40 text-xs">
            <div className="flex justify-between items-center text-[11px] text-slate-300 mb-1">
              <span className="font-medium">Daily Draft Quota</span>
              <span className="font-mono font-bold text-blue-400" data-testid="sidebar-draft-quota-count">
                {draftStats.today_drafts_count || 0} / 50
              </span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, ((draftStats.today_drafts_count || 0) / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path || (link.path !== '/dashboard' && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  data-testid={link.testId}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{link.name}</span>
                  </div>
                  {link.badge && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold border ${link.badgeColor || 'bg-slate-800 text-blue-300 border-slate-700'}`}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

       {/* Bottom Actions */}
<div className="p-3 border-t border-slate-800">
  <button
    onClick={logout}
    data-testid="logout-button"
    className="w-full flex items-center justify-center space-x-3 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
  >
    <LogOut size={16} />
    <span>Sign Out</span>
  </button>
</div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Trial / subscription banner */}
        {user?.role !== 'admin' && is_trial && days_left != null && (
          <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm" data-testid="trial-banner">
            <div className="flex items-center space-x-2">
              <Sparkles size={16} className="flex-shrink-0" />
              <span>
                <strong>Free Trial:</strong> {days_left} din baaki hain. Vyastha Pro ke saare features enjoy karein.
              </span>
            </div>
            <Link to="/subscription" data-testid="banner-upgrade-link" className="font-bold underline flex-shrink-0 ml-3 hover:text-blue-100">
              Upgrade &rarr;
            </Link>
          </div>
        )}
        {!is_trial && entitlements?.status === 'expired' && user?.role !== 'admin' && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm" data-testid="expired-banner">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span><strong>Trial khatam ho gaya.</strong> Pro features unlock karne ke liye upgrade karein.</span>
            </div>
            <Link to="/subscription" className="font-bold underline flex-shrink-0 ml-3">Upgrade &rarr;</Link>
          </div>
        )}

        {/* Global Low Stock Banner */}
        {lowStockCount > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-300/40 px-4 py-2.5 flex items-center justify-between text-amber-900 text-xs sm:text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
              <span>
                <strong>Inventory Alert:</strong> {lowStockCount} product(s) have reached or fallen below their low-stock threshold.
              </span>
            </div>
            <Link 
              to="/inventory" 
              data-testid="banner-view-inventory-link"
              className="font-bold underline text-amber-900 hover:text-amber-950 flex-shrink-0 ml-3"
            >
              Review Stock &rarr;
            </Link>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      {user?.role !== 'admin' && <AskVyastha />}
    </div>
  );
}