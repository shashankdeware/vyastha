import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useEntitlements } from '../context/EntitlementContext';
import {
  Sparkles, X, Send, Mic, MicOff, Volume2, Loader2, Lock, Languages, Bot, User as UserIcon
} from 'lucide-react';
import { toast } from 'sonner';

const LANGS = [
  { key: 'hinglish', label: 'Hinglish', code: 'hi-IN' },
  { key: 'hindi', label: 'हिंदी', code: 'hi-IN' },
  { key: 'english', label: 'English', code: 'en-IN' },
  { key: 'marathi', label: 'मराठी', code: 'mr-IN' },
];

export default function AskVyastha() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('vyastha_ai_lang') || 'hinglish');
  const [suggestions, setSuggestions] = useState(null);
  const [listening, setListening] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { hasFeature } = useEntitlements();
  const canUseAI = hasFeature('ai_business_assistant');
  const canVoice = hasFeature('voice_assistant');

  useEffect(() => { localStorage.setItem('vyastha_ai_lang', language); }, [language]);

  useEffect(() => {
    if (open && !suggestions) {
      api.get('/ai/suggestions').then((r) => setSuggestions(r.data)).catch(() => {});
    }
  }, [open, suggestions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (LANGS.find((l) => l.key === language) || LANGS[0]).code;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };

  const send = async (question) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setPendingAction(null);
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/ask', { question: q, language });
      const { reply, suggested_action } = res.data;
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      if (suggested_action) setPendingAction(suggested_action);
    } catch (err) {
      if (err.response?.status === 402) {
        setMessages((m) => [...m, { role: 'assistant', text: 'Ask Vyastha AI ek Pro feature hai. Please upgrade karein.' }]);
      } else {
        toast.error('Ask Vyastha abhi available nahi hai');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error('Aapke browser mein voice input support nahi hai'); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = (LANGS.find((l) => l.key === language) || LANGS[0]).code;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); toast.error('Voice sunne mein dikkat aayi, dobara try karein'); };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      send(transcript);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const runAction = () => {
    if (pendingAction?.type === 'navigate') {
      navigate(pendingAction.target);
      setOpen(false);
      setPendingAction(null);
    } else if (pendingAction?.type === 'invoice_draft') {
      sessionStorage.setItem('vyastha_invoice_draft', JSON.stringify(pendingAction.draft));
      navigate('/invoices/new');
      setOpen(false);
      setPendingAction(null);
      toast.success('Invoice draft taiyaar hai — details confirm karke save karein');
    }
  };

  return (
    <>
      {!open && (
        <button
          data-testid="ask-vyastha-fab"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 transition-all hover:scale-105"
        >
          <Sparkles size={18} />
          <span className="font-bold text-sm hidden sm:inline">Ask Vyastha</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="ask-vyastha-panel">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="font-extrabold leading-none">Ask Vyastha</p>
                  <p className="text-[11px] text-blue-300">Smart Business Assistant</p>
                </div>
              </div>
              <button data-testid="ask-vyastha-close" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            {/* Language selector */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
              <Languages size={14} className="text-slate-400 flex-shrink-0" />
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  data-testid={`ai-lang-${l.key}`}
                  onClick={() => setLanguage(l.key)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-colors ${
                    language === l.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {!canUseAI ? (
                <div className="text-center py-10 space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center"><Lock className="text-blue-600" /></div>
                  <p className="font-bold text-slate-800">Ask Vyastha is a Pro feature</p>
                  <p className="text-sm text-slate-500 px-6">Apne business ke real-time sawaalon ke jawaab paane ke liye Pro plan lein.</p>
                  <button data-testid="ai-upgrade-btn" onClick={() => { navigate('/subscription'); setOpen(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">View Plans</button>
                </div>
              ) : (
                <>
                  {messages.length === 0 && suggestions && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-white" /></div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
                          {suggestions.greeting}
                        </div>
                      </div>
                      {suggestions.dynamic?.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 px-1">For You</p>
                          {suggestions.dynamic.map((qq, i) => (
                            <button key={i} data-testid={`ai-dynamic-suggestion-${i}`} onClick={() => send(qq)} className="block w-full text-left text-sm px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100">
                              {qq}
                            </button>
                          ))}
                        </div>
                      )}
                      {suggestions.categories && Object.entries(suggestions.categories).map(([cat, qs]) => (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">{cat}</p>
                          {qs.map((qq, i) => (
                            <button key={i} data-testid={`ai-suggestion-${cat}-${i}`} onClick={() => send(qq)} className="block w-full text-left text-sm px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50">
                              {qq}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                        {m.role === 'user' ? <UserIcon size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm whitespace-pre-wrap ${
                        m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                      }`}>
                        {m.text}
                        {m.role === 'assistant' && (
                          <button onClick={() => speak(m.text)} className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-600 font-semibold">
                            <Volume2 size={13} /> Sunein
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {pendingAction && (
                    <div className="ml-10 bg-white border border-blue-200 rounded-2xl p-3 space-y-2 shadow-sm" data-testid="ai-action-card">
                      <p className="text-sm text-slate-700">{pendingAction.confirm || `Kya main "${pendingAction.label}" khol doon?`}</p>
                      <div className="flex gap-2">
                        <button data-testid="ai-action-confirm" onClick={runAction} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">Haan, karo</button>
                        <button onClick={() => setPendingAction(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Nahi</button>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center"><Bot size={16} className="text-white" /></div>
                      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3"><Loader2 className="animate-spin text-blue-600" size={16} /></div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Composer */}
            {canUseAI && (
              <div className="p-3 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="ai-voice-btn"
                    onClick={toggleVoice}
                    disabled={!canVoice}
                    title={canVoice ? 'Bolkar poochhein' : 'Voice Pro feature hai'}
                    className={`p-2.5 rounded-xl flex-shrink-0 ${listening ? 'bg-red-600 text-white animate-pulse' : canVoice ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-100 text-slate-300'}`}
                  >
                    {listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <input
                    data-testid="ai-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder={listening ? 'Sun raha hoon...' : 'Apna business sawaal poochhein...'}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button data-testid="ai-send-btn" onClick={() => send()} disabled={loading || !input.trim()} className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-40 flex-shrink-0">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
