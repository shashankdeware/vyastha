import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useEntitlements } from '../context/EntitlementContext';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  const [state, setState] = useState('checking'); // checking | success | failed | timeout
  const navigate = useNavigate();
  const { refresh } = useEntitlements();
  const pollCount = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) { setState('failed'); return; }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      if (pollCount.current >= 12) { setState('timeout'); return; }
      pollCount.current += 1;
      try {
        const res = await api.get(`/subscription/status/${sessionId}`);
        if (res.data.payment_status === 'paid') {
          setState('success');
          refresh();
          return;
        }
        if (['failed', 'expired'].includes(res.data.payment_status)) { setState('failed'); return; }
      } catch (e) { /* keep polling */ }
      setTimeout(poll, 2500);
    };
    poll();
    return () => { cancelled = true; };
  }, [refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4" data-testid="subscription-success-page">
        {state === 'checking' && (<><Loader2 className="animate-spin text-blue-600 mx-auto" size={40} /><p className="font-bold text-slate-800">Payment verify kar rahe hain...</p><p className="text-sm text-slate-500">Kripya wait karein, page band na karein.</p></>)}
        {state === 'success' && (<><CheckCircle2 className="text-emerald-500 mx-auto" size={48} /><p className="text-xl font-extrabold text-slate-900">Payment Successful!</p><p className="text-sm text-slate-500">Aapka Vyastha Pro plan active ho gaya hai. Dhanyavaad!</p><button data-testid="success-dashboard-btn" onClick={() => navigate('/dashboard')} className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">Go to Dashboard</button></>)}
        {(state === 'failed' || state === 'timeout') && (<><XCircle className="text-red-500 mx-auto" size={48} /><p className="text-xl font-extrabold text-slate-900">{state === 'timeout' ? 'Verification pending' : 'Payment failed'}</p><p className="text-sm text-slate-500">{state === 'timeout' ? 'Payment abhi confirm nahi hua. Thodi der baad subscription page check karein.' : 'Payment complete nahi hua.'}</p><button onClick={() => navigate('/subscription')} className="mt-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">Back to Plans</button></>)}
      </div>
    </div>
  );
}
