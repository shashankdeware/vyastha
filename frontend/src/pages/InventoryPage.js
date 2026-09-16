import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StockAdjustModal from '../components/StockAdjustModal';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Edit3,
  Trash2,
  ArrowUpDown,
  Package,
  X,
  Layers,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  category: 'General',
  unit: 'pc',
  unit_price: 0,
  stock_quantity: 0,
  low_stock_threshold: 10,
  description: '',
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL | LOW_STOCK | OUT_OF_STOCK
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [tab, setTab] = useState('products'); // products | transactions

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/inventory/transactions');
      setTransactions(res.data || []);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
  }, []);

  const openCreate = () => {
    setEditingProduct({ ...EMPTY_PRODUCT });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingProduct({ ...p });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingProduct.name) {
      toast.error('Product name is required');
      return;
    }
    try {
      const payload = {
        ...editingProduct,
        unit_price: parseFloat(editingProduct.unit_price) || 0,
        stock_quantity: parseInt(editingProduct.stock_quantity) || 0,
        low_stock_threshold: parseInt(editingProduct.low_stock_threshold) || 0,
      };
      if (editingProduct.id) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product added to inventory');
      }
      setShowModal(false);
      setEditingProduct(null);
      fetchProducts();
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete product "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'ALL') return matchesSearch;
    if (filter === 'LOW_STOCK') return matchesSearch && p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0;
    if (filter === 'OUT_OF_STOCK') return matchesSearch && p.stock_quantity === 0;
    return matchesSearch;
  });

  const lowStockCount = products.filter((p) => p.stock_quantity <= p.low_stock_threshold).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
            data-testid="inventory-page-title"
          >
            Inventory & Stock Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track SKUs, monitor low-stock alerts, and auto-deduct stock on every invoice.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          data-testid="add-product-btn"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Add Product / SKU</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total SKUs</span>
            <Layers size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono" data-testid="stat-total-skus">
            {products.length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock Value</span>
            <Package size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono" data-testid="stat-stock-value">
            ₹{totalValue.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Low Stock Items</span>
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono" data-testid="stat-low-stock">
            {lowStockCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Out of Stock</span>
            <X size={16} className="text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600 font-mono" data-testid="stat-out-of-stock">
            {outOfStockCount}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          data-testid="tab-products-btn"
          onClick={() => setTab('products')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'products'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Products & Stock
        </button>
        <button
          type="button"
          data-testid="tab-transactions-btn"
          onClick={() => setTab('transactions')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-1.5 ${
            tab === 'transactions'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={14} />
          <span>Stock Movement Log</span>
        </button>
      </div>

      {tab === 'products' && (
        <>
          {/* Search + Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-inventory-input"
                placeholder="Search by product name, SKU or category..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {[
                { key: 'ALL', label: 'All Items' },
                { key: 'LOW_STOCK', label: 'Low Stock' },
                { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  data-testid={`filter-inventory-${f.key.toLowerCase()}`}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
                    filter === f.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs">Loading inventory...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-3">
                <Boxes size={32} className="mx-auto text-slate-300" />
                <p>No products found in inventory.</p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-block font-bold text-blue-600 hover:underline"
                >
                  Add your first product &rarr;
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="inventory-list-table">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Product / SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-center">Stock</th>
                      <th className="py-3 px-4 text-center">Low Alert</th>
                      <th className="py-3 px-4 text-right">Stock Value</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((p) => {
                      const isLow = p.stock_quantity <= p.low_stock_threshold;
                      const isOut = p.stock_quantity === 0;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/80 transition-colors"
                          data-testid={`product-row-${p.sku}`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-700">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            ₹{p.unit_price?.toLocaleString('en-IN')}
                            <span className="block text-[9px] text-slate-400 font-sans font-normal">
                              per {p.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
                                isOut
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              {p.stock_quantity} {p.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono">
                            ≤ {p.low_stock_threshold}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-800">
                            ₹{(p.stock_quantity * p.unit_price).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setAdjustingProduct(p)}
                              data-testid={`adjust-stock-btn-${p.sku}`}
                              title="Adjust Stock (In / Out)"
                              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            >
                              <ArrowUpDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              data-testid={`edit-product-btn-${p.sku}`}
                              title="Edit Product"
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id, p.name)}
                              data-testid={`delete-product-btn-${p.sku}`}
                              title="Delete Product"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs space-y-3">
              <History size={32} className="mx-auto text-slate-300" />
              <p>No stock movements recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="transactions-table">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Qty Change</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => {
                    const isPositive = t.quantity > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {new Date(t.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{t.product_name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPositive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {t.quantity}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{t.reason}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{t.reference}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product Create/Edit Modal */}
      {showModal && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Boxes size={18} className="text-blue-400" />
                <h3 className="font-bold text-base tracking-tight" data-testid="product-modal-title">
                  {editingProduct.id ? 'Edit Product' : 'Add New Product'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProduct(null);
                }}
                data-testid="product-modal-close-btn"
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                    data-testid="product-name-input"
                    placeholder="e.g. Steel Bearing 6205"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    SKU (Optional — auto-generated)
                  </label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sku: e.target.value.toUpperCase() })
                    }
                    data-testid="product-sku-input"
                    placeholder="SKU-0001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    data-testid="product-category-input"
                    placeholder="e.g. Bearings"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={editingProduct.unit}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unit: e.target.value })
                    }
                    data-testid="product-unit-input"
                    placeholder="pc, kg, box"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingProduct.unit_price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unit_price: e.target.value })
                    }
                    data-testid="product-price-input"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stock_quantity}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock_quantity: e.target.value })
                    }
                    data-testid="product-stock-input"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold"
                    disabled={Boolean(editingProduct.id)}
                  />
                  {editingProduct.id && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Use "Adjust Stock" to modify current stock level.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Low Stock Threshold *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.low_stock_threshold}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        low_stock_threshold: e.target.value,
                      })
                    }
                    data-testid="product-threshold-input"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    data-testid="product-desc-input"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="Notes / specifications"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                  }}
                  data-testid="product-cancel-btn"
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="product-save-btn"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  {editingProduct.id ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      <StockAdjustModal
        isOpen={Boolean(adjustingProduct)}
        product={adjustingProduct}
        onClose={() => setAdjustingProduct(null)}
        onAdjustSuccess={() => {
          fetchProducts();
          fetchTransactions();
        }}
      />
    </div>
  );
}
