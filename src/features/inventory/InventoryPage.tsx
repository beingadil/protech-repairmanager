import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Download,
  TrendingUp,
  History,
  Layers,
  Edit2,
  Trash2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  X,
  MapPin,
  Tag,
  Boxes,
  RotateCcw,
  RefreshCw,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { query, execute } from '../../lib/db';
import { InventoryItem, InventoryTransaction, InventoryCategory, InventoryStats } from '../../types/inventory';
import { exportInventoryToCSV } from '../../lib/export-utils';

const CATEGORIES: InventoryCategory[] = [
  'RAM',
  'Storage (SSD/HDD)',
  'LCD Displays',
  'Batteries',
  'Keyboards',
  'IC / Motherboard',
  'Chargers & Power',
  'Cooling & Paste',
  'Accessories & Cables',
  'Other'
];

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL'); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'TRANSACTIONS'>('ITEMS');

  // Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockChangeType, setStockChangeType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [stockQty, setStockQty] = useState<number>(1);
  const [stockCost, setStockCost] = useState<number>(0);
  const [stockNotes, setStockNotes] = useState<string>('');

  // Item Form State
  const [formData, setFormData] = useState({
    part_number: '',
    name: '',
    category: 'RAM' as InventoryCategory,
    quantity: 0,
    min_threshold: 2,
    unit_cost: 0,
    selling_price: 0,
    location: 'Shelf A1',
    supplier_info: '',
    notes: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const itemsData = await query<InventoryItem>(
        'SELECT * FROM inventory_items ORDER BY category ASC, name ASC'
      );
      setItems(itemsData);

      const transData = await query<any>(`
        SELECT t.*, i.name as item_name 
        FROM inventory_transactions t
        LEFT JOIN inventory_items i ON t.item_id = i.id
        ORDER BY t.created_at DESC
        LIMIT 100
      `);
      setTransactions(transData);
    } catch (err) {
      console.error('Failed loading inventory:', err);
      toast.error('Failed to load inventory dataset');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Stats
  const stats: InventoryStats = items.reduce(
    (acc, item) => {
      acc.total_items += 1;
      acc.total_quantity += item.quantity;
      if (item.quantity === 0) {
        acc.out_of_stock_count += 1;
      } else if (item.quantity <= item.min_threshold) {
        acc.low_stock_count += 1;
      }
      acc.total_cost_value += item.quantity * item.unit_cost;
      acc.total_retail_value += item.quantity * item.selling_price;
      return acc;
    },
    {
      total_items: 0,
      total_quantity: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      total_cost_value: 0,
      total_retail_value: 0
    }
  );

  const lowStockItems = items.filter((i) => i.quantity <= i.min_threshold);

  // Filtered Items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.supplier_info && item.supplier_info.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    let matchesStock = true;
    if (stockStatusFilter === 'LOW_STOCK') {
      matchesStock = item.quantity > 0 && item.quantity <= item.min_threshold;
    } else if (stockStatusFilter === 'OUT_OF_STOCK') {
      matchesStock = item.quantity === 0;
    } else if (stockStatusFilter === 'IN_STOCK') {
      matchesStock = item.quantity > item.min_threshold;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Modal Handlers
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      part_number: `PART-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: 'RAM',
      quantity: 5,
      min_threshold: 2,
      unit_cost: 0,
      selling_price: 0,
      location: 'Shelf A1',
      supplier_info: '',
      notes: ''
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      part_number: item.part_number,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      min_threshold: item.min_threshold,
      unit_cost: item.unit_cost,
      selling_price: item.selling_price,
      location: item.location || 'Shelf A1',
      supplier_info: item.supplier_info || '',
      notes: item.notes || ''
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_number.trim() || !formData.name.trim()) {
      toast.error('Part number and Name are required');
      return;
    }

    try {
      if (editingItem) {
        await execute(
          `UPDATE inventory_items 
           SET part_number = ?, name = ?, category = ?, quantity = ?, min_threshold = ?, 
               unit_cost = ?, selling_price = ?, location = ?, supplier_info = ?, notes = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            formData.part_number.trim(),
            formData.name.trim(),
            formData.category,
            formData.quantity,
            formData.min_threshold,
            formData.unit_cost,
            formData.selling_price,
            formData.location.trim(),
            formData.supplier_info.trim(),
            formData.notes.trim(),
            editingItem.id
          ]
        );
        toast.success(`Updated part '${formData.name}'`);
      } else {
        await execute(
          `INSERT INTO inventory_items 
           (part_number, name, category, quantity, min_threshold, unit_cost, selling_price, location, supplier_info, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.part_number.trim(),
            formData.name.trim(),
            formData.category,
            formData.quantity,
            formData.min_threshold,
            formData.unit_cost,
            formData.selling_price,
            formData.location.trim(),
            formData.supplier_info.trim(),
            formData.notes.trim()
          ]
        );

        // Record initial inventory transaction log
        const newPartRes = await query<{ id: number }>('SELECT last_insert_rowid() as id');
        if (newPartRes.length > 0) {
          await execute(
            `INSERT INTO inventory_transactions (item_id, type, quantity_changed, unit_cost, notes)
             VALUES (?, 'IN', ?, ?, 'Initial inventory creation')`,
            [newPartRes[0].id, formData.quantity, formData.unit_cost]
          );
        }

        toast.success(`Added new part '${formData.name}'`);
      }

      setIsItemModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save item error:', err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        toast.error(`Part number '${formData.part_number}' already exists!`);
      } else {
        toast.error('Failed to save item.');
      }
    }
  };

  const handleDeleteItem = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}' from inventory?`)) return;

    try {
      await execute('DELETE FROM inventory_items WHERE id = ?', [id]);
      toast.success(`Removed '${name}' from stock catalog.`);
      loadData();
    } catch (err) {
      console.error('Delete item error:', err);
      toast.error('Failed to delete item.');
    }
  };

  const handleOpenStockAdjust = (item: InventoryItem, defaultType: 'IN' | 'OUT' | 'ADJUST' = 'IN') => {
    setStockItem(item);
    setStockChangeType(defaultType);
    setStockQty(1);
    setStockCost(item.unit_cost);
    setStockNotes(defaultType === 'IN' ? 'Restocked from supplier' : 'Used for repair');
    setIsStockModalOpen(true);
  };

  const handleSaveStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockItem) return;

    if (stockQty <= 0) {
      toast.error('Quantity must be greater than zero.');
      return;
    }

    let newQty = stockItem.quantity;
    let qtyChanged = stockQty;

    if (stockChangeType === 'IN') {
      newQty = stockItem.quantity + stockQty;
    } else if (stockChangeType === 'OUT') {
      if (stockQty > stockItem.quantity) {
        toast.error(`Cannot deduct ${stockQty} items! Current stock is only ${stockItem.quantity}.`);
        return;
      }
      newQty = stockItem.quantity - stockQty;
      qtyChanged = -stockQty;
    } else if (stockChangeType === 'ADJUST') {
      newQty = stockQty; // set directly
      qtyChanged = stockQty - stockItem.quantity;
    }

    try {
      // 1. Update item stock quantity & unit cost
      await execute(
        `UPDATE inventory_items SET quantity = ?, unit_cost = ?, updated_at = datetime('now') WHERE id = ?`,
        [newQty, stockChangeType === 'IN' ? stockCost : stockItem.unit_cost, stockItem.id]
      );

      // 2. Record transaction log
      await execute(
        `INSERT INTO inventory_transactions (item_id, type, quantity_changed, unit_cost, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [stockItem.id, stockChangeType, qtyChanged, stockCost, stockNotes.trim()]
      );

      toast.success(`Stock updated for '${stockItem.name}'. New Qty: ${newQty}`);
      setIsStockModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Stock adjust error:', err);
      toast.error('Failed to update stock quantity.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-container border-l-4 border-l-blue-600">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
              Spare Parts & Stock Inventory
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track hardware parts, monitor low stock alerts, restock supplies, and manage total inventory valuation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportInventoryToCSV(items)}
            className="btn-secondary text-xs"
            title="Export full inventory report to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button onClick={handleOpenAdd} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Add New Part</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Catalog Items */}
        <div className="card-container flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
              Total Parts Catalog
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1 block">
              {stats.total_items} <span className="text-xs font-normal text-slate-500">items</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">
              Total Qty: {stats.total_quantity} units
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="card-container flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
              Low Stock Alert
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block flex items-center gap-1.5">
              {stats.low_stock_count}
              {stats.low_stock_count > 0 && (
                <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  Action Required
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Quantity ≤ Min Threshold
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="card-container flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
              Out of Stock
            </span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1 block">
              {stats.out_of_stock_count}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Empty stock level (0 Qty)
            </span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-500/20">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="card-container flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
              Stock Valuation (Cost)
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
              {formatCurrency(stats.total_cost_value)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">
              Retail: {formatCurrency(stats.total_retail_value)}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Low Stock Warning ({lowStockItems.length} items need restock)</span>
            </div>
            <button
              onClick={() => setStockStatusFilter('LOW_STOCK')}
              className="text-[11px] text-amber-700 dark:text-amber-400 font-bold underline hover:opacity-80 cursor-pointer"
            >
              View Low Stock Only →
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/30 rounded-xl text-xs font-semibold shadow-2xs"
              >
                <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded font-mono font-bold text-[10px]">
                  {item.quantity} in stock
                </span>
                <button
                  onClick={() => handleOpenStockAdjust(item, 'IN')}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Restock
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Content Area */}
      <div className="card-container space-y-5">
        {/* Navigation Tabs & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('ITEMS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'ITEMS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Stock Catalog ({items.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'TRANSACTIONS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Movement History ({transactions.length})</span>
            </button>
          </div>

          {/* Search & Filters */}
          {activeTab === 'ITEMS' && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search part #, name, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-9 text-xs"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field text-xs w-36 font-medium cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Stock Status Filter */}
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="input-field text-xs w-36 font-medium cursor-pointer"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock Alert</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Stock Catalog Table */}
        {activeTab === 'ITEMS' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3">Part # / Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Stock Level</th>
                  <th className="py-3 px-3">Cost / Selling Price</th>
                  <th className="py-3 px-3">Location & Supplier</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading stock items...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No matching spare parts found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.quantity <= item.min_threshold && item.quantity > 0;
                    const isOut = item.quantity === 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Part Number & Name */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                            {item.part_number}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
                            {item.name}
                          </div>
                          {item.notes && (
                            <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                              {item.notes}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
                            {item.category}
                          </span>
                        </td>

                        {/* Stock Level Qty */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {item.quantity}
                            </span>
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                In Stock
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                            Min Threshold: {item.min_threshold}
                          </span>
                        </td>

                        {/* Cost & Selling */}
                        <td className="py-3 px-3 font-mono">
                          <div className="text-slate-900 dark:text-slate-100 font-bold">
                            {formatCurrency(item.unit_cost)} <span className="text-[10px] font-normal text-slate-400">(Cost)</span>
                          </div>
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            {formatCurrency(item.selling_price)} <span className="text-[10px] font-normal text-slate-400">(Sell)</span>
                          </div>
                        </td>

                        {/* Location & Supplier */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.location || 'N/A'}</span>
                          </div>
                          {item.supplier_info && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                              {item.supplier_info}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenStockAdjust(item, 'IN')}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                              title="Stock In / Restock"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Restock</span>
                            </button>

                            <button
                              onClick={() => handleOpenStockAdjust(item, 'OUT')}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-lg border border-amber-500/30 transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                              title="Deduct Stock"
                            >
                              <ArrowDownRight className="w-3 h-3" />
                              <span>Use</span>
                            </button>

                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                              title="Edit Part Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Transaction Audit Logs */}
        {activeTab === 'TRANSACTIONS' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Part Item</th>
                  <th className="py-3 px-3">Action Type</th>
                  <th className="py-3 px-3">Quantity Changed</th>
                  <th className="py-3 px-3">Unit Cost</th>
                  <th className="py-3 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No stock movement transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-slate-500 font-medium">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 font-sans">
                        {t.item_name || `Item #${t.item_id}`}
                      </td>
                      <td className="py-3 px-3">
                        {t.type === 'IN' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <ArrowUpRight className="w-3 h-3" /> STOCK IN
                          </span>
                        ) : t.type === 'OUT' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
                            <ArrowDownRight className="w-3 h-3" /> STOCK OUT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
                            <RefreshCw className="w-3 h-3" /> ADJUSTMENT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-black text-sm">
                        <span className={t.quantity_changed > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {t.quantity_changed > 0 ? `+${t.quantity_changed}` : t.quantity_changed}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {t.unit_cost ? formatCurrency(t.unit_cost) : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                        {t.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Part Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                  {editingItem ? 'Edit Spare Part' : 'Add New Spare Part'}
                </h3>
                <button
                  onClick={() => setIsItemModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Part SKU / Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                      placeholder="e.g. RAM-DDR4-8GB"
                      className="input-field font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                      className="input-field font-semibold cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Part Name / Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kingston DDR4 8GB 3200MHz Laptop RAM"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Initial Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      className="input-field font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Min Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.min_threshold}
                      onChange={(e) => setFormData({ ...formData, min_threshold: parseInt(e.target.value) || 1 })}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Purchase Cost (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                      className="input-field font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Selling Price (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Shelf / Bin Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Bin A-02"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Supplier Info
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_info}
                      onChange={(e) => setFormData({ ...formData, supplier_info: e.target.value })}
                      placeholder="e.g. Al-Madina Computers"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Notes & Compatibility
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Compatible with Dell, HP, Lenovo 8th-11th Gen"
                    className="input-field"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsItemModalOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary text-xs">
                    {editingItem ? 'Update Part' : 'Save New Part'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Adjust / Restock Modal */}
      <AnimatePresence>
        {isStockModalOpen && stockItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                    Adjust Stock Qty
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold">
                    {stockItem.name} ({stockItem.quantity} in stock)
                  </p>
                </div>
                <button
                  onClick={() => setIsStockModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStockAdjust} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Action Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setStockChangeType('IN')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        stockChangeType === 'IN'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Restock IN
                    </button>

                    <button
                      type="button"
                      onClick={() => setStockChangeType('OUT')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        stockChangeType === 'OUT'
                          ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" /> Deduct OUT
                    </button>

                    <button
                      type="button"
                      onClick={() => setStockChangeType('ADJUST')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        stockChangeType === 'ADJUST'
                          ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Set Exact Qty
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {stockChangeType === 'ADJUST' ? 'New Exact Quantity' : 'Quantity Units'} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stockQty}
                      onChange={(e) => setStockQty(parseInt(e.target.value) || 1)}
                      className="input-field font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Unit Cost (PKR)
                    </label>
                    <input
                      type="number"
                      value={stockCost}
                      onChange={(e) => setStockCost(parseFloat(e.target.value) || 0)}
                      className="input-field font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Movement Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                    placeholder="e.g. Supplier restock or Used on Job TK-1002"
                    className="input-field"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsStockModalOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary text-xs">
                    Confirm Stock Update
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
