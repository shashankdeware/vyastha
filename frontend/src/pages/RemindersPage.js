import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { formatINR } from '../lib/format';
import { MessageCircle, AlertTriangle, Copy, Phone, Loader2, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

export default function RemindersPage() {
  const [data, setData] = useState({ reminders: [], count: 0, total_outstanding: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reminders/pending').then((r) => setData(r.data)).catch(() => toast.error('Reminders load nahi hue')).finally(() => setLoading(false));
  }, []);

  const sendWhatsApp = (rem) => {
    if (!rem.whatsapp_url) { toast.error('Is customer ka valid phone number nahi hai'); return; }
    window.open(rem.whatsapp_url, '_blank');
  };

  const copyMsg = (msg) => { navigator.clipboard.writeText(msg); toast.success('Message copy ho gaya'); };

  if (loading) return <div className="py-20 text-center text-slate-500">Loading reminders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="reminders-title">Payment Reminders</h1>
        <p className="text-sm text-slate-500">Overdue aur pending bills ke liye customers ko ek tap mein WhatsApp par nudge karein.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Invoices</p>
          <p className="text-2xl font-black text-slate-950 font-mono" data-testid="reminders-count">{data.count}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Outstanding</p>
          <p className="text-2xl font-black text-amber-600 font-mono">{formatINR(data.total_outstanding)}</p>
        </div>
      </div>

      {data.reminders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center text-slate-400">
          <IndianRupee className="mx-auto text-slate-300 mb-2" size={32} />
          <p className="text-sm">Koi pending payment nahi — sab settled hai! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.reminders.map((r) => (
            <div key={r.invoice_id} data-testid={`reminder-row-${r.invoice_number}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-900">{r.invoice_number}</span>
                  {r.overdue && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase flex items-center gap-1"><AlertTriangle size={11} /> Overdue</span>}
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{r.customer || 'Customer'}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={12} /> {r.phone || 'No phone'} · Due {r.invoice_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-amber-600 text-lg">{formatINR(r.balance_due)}</span>
                <button onClick={() => copyMsg(r.message)} title="Copy message" className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><Copy size={16} /></button>
                <button
                  data-testid={`whatsapp-btn-${r.invoice_number}`}
                  onClick={() => sendWhatsApp(r)}
                  disabled={!r.has_phone}
                  className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 text-center">WhatsApp reminders click-to-chat ke through bheje jaate hain — koi API key ki zarurat nahi.</p>
    </div>
  );
}
