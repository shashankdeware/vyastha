import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Check, Boxes } from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

export default function StockAdjustModal({ isOpen, onClose, product, onAdjustSuccess }) {
  const [type, setType] = useState('IN'); // 'IN' or 'OUT'
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Purchase receipt / supplier stock');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/products/${product.id}/adjust-stock`, {
        quantity: qtyNum,
        type,
        reason,
        reference: reference || (type === 'IN' ? 'PO-RESTOCK' : 'MANUAL_DISPATCH')
      });
      toast.success(`Stock ${type === 'IN' ? 'added' : 'deducted'} successfully!`);
      if (onAdjustSuccess) onAdjustSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Boxes size={18} className="text-blue-400" />
            <h3 className="font-bold text-base tracking-tight" data-testid="stock-modal-title">
              Stock In / Out Adjustment
            </h3>
          </div>
          <button 
            onClick={onClose} 
            data-testid="stock-modal-close-btn"
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="font-bold text-slate-900 text-sm mb-1">{product.name}</div>
            <div className="flex justify-between text-slate-600 font-mono">
              <span>SKU: {product.sku}</span>
              <span>Current Stock: <strong className="text-slate-900">{product.stock_quantity} {product.unit}</strong></span>
            </div>
          </div>

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="stock-type-in-btn"
              onClick={() => {
                setType('IN');
                setReason('Purchase receipt / supplier stock');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                type === 'IN'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowDownLeft size={16} className="text-emerald-600" />
              <span>STOCK IN (Add)</span>
            </button>

            <button
              type="button"
              data-testid="stock-type-out-btn"
              onClick={() => {
                setType('OUT');
                setReason('Damage / wastage / manual dispatch');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                type === 'OUT'
                  ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight size={16} className="text-red-600" />
              <span>STOCK OUT (Deduct)</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity ({product.unit || 'units'}) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="stock-quantity-input"
              placeholder="e.g. 25"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason / Description
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="stock-reason-input"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reference / PO # (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              data-testid="stock-reference-input"
              placeholder="e.g. PO-88192"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              data-testid="stock-cancel-btn"
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="stock-submit-btn"
              className={`px-5 py-2 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1.5 ${
                type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Check size={14} />
              <span>{loading ? 'Updating...' : `Update Stock (${type})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}