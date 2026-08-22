import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Settings,
  Save,
  Store,
  Printer,
  ShieldCheck,
  Moon,
  Sun,
  Upload,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  Laptop,
  Cpu,
  Wrench,
  Shield,
  Server,
  Monitor,
  Users,
  UserPlus,
  KeyRound,
  UserCheck,
  FileText,
  MessageSquare,
  Cloud,
  Database,
  Download,
  Receipt,
  QrCode,
  Lock,
  Edit2,
  CheckCircle2,
  DollarSign,
  Building,
  Phone,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/settings';
import { useAuthStore } from '../../store/auth';
import { UserRole, UserAccount } from '../../types/auth';
import { useTheme } from '../../hooks/useTheme';
import { resetDatabaseToProduction, exportDatabaseBinary, restoreDatabaseBinary, query } from '../../lib/db';
import { ProTechLogo } from '../../components/shared/ProTechLogo';
import { SyncSettingsComponent } from '../../components/sync/SyncSettingsComponent';
import { exportJobsToCSV, exportCustomersToCSV, exportLedgerToCSV, exportInventoryToCSV } from '../../lib/export-utils';

type SettingsTab = 'identity' | 'receipt' | 'workflow' | 'users' | 'notifications' | 'backup';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettingsBatch, updateSetting } = useSettingsStore();
  const { users, addUser, deleteUser, updateUserPassword, updateUserProfile, currentUser } = useAuthStore();
  const { isDark, toggleTheme } = useTheme('dark');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');

  // Shop Identity Form State
  const [shopName, setShopName] = useState(settings.shop_name);
  const [shopSlogan, setShopSlogan] = useState(settings.shop_slogan || '');
  const [shopAddress, setShopAddress] = useState(settings.shop_address);
  const [shopMobile, setShopMobile] = useState(settings.shop_mobile);
  const [shopWhatsapp, setShopWhatsapp] = useState(settings.shop_whatsapp || '');
  const [shopEmail, setShopEmail] = useState(settings.shop_email || '');
  const [logoPath, setLogoPath] = useState(settings.logo_path || '');

  // Receipt & Print Form State
  const [thermalSize, setThermalSize] = useState<'58' | '80' | 'a4'>((settings.thermal_size as any) || '80');
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency_symbol || 'PKR');
  const [receiptHeaderMsg, setReceiptHeaderMsg] = useState(settings.receipt_header_msg || '');
  const [receiptFooterMsg, setReceiptFooterMsg] = useState(settings.receipt_footer_msg || '');
  const [receiptTerms, setReceiptTerms] = useState(settings.receipt_terms || '');
  const [showQrOnReceipt, setShowQrOnReceipt] = useState(settings.show_qr_on_receipt !== '0');
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(settings.show_logo_on_receipt !== '0');

  // Workflow Form State
  const [defaultCharges, setDefaultCharges] = useState(settings.default_charges || '1500');
  const [defaultWarrantyDays, setDefaultWarrantyDays] = useState(settings.default_warranty_days || '30');
  const [defaultTurnaroundDays, setDefaultTurnaroundDays] = useState(settings.default_turnaround_days || '2');
  const [tokenPrefix, setTokenPrefix] = useState(settings.token_prefix || 'PTS');

  // Gateway Form State
  const [twilioSid, setTwilioSid] = useState(settings.twilio_sid || '');
  const [twilioToken, setTwilioToken] = useState(settings.twilio_token || '');
  const [twilioFrom, setTwilioFrom] = useState(settings.twilio_from || '');
  const [autoBackup, setAutoBackup] = useState(settings.auto_backup === '1');

  // User creation form state
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Technician');

  // Edit password modal state
  const [editingUserPassword, setEditingUserPassword] = useState<UserAccount | null>(null);
  const [changePasswordInput, setChangePasswordInput] = useState('');

  // Admin Data Wipe state
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    setShopName(settings.shop_name);
    setShopSlogan(settings.shop_slogan || '');
    setShopAddress(settings.shop_address);
    setShopMobile(settings.shop_mobile);
    setShopWhatsapp(settings.shop_whatsapp || '');
    setShopEmail(settings.shop_email || '');
    setLogoPath(settings.logo_path || '');
    setThermalSize((settings.thermal_size as any) || '80');
    setCurrencySymbol(settings.currency_symbol || 'PKR');
    setReceiptHeaderMsg(settings.receipt_header_msg || '');
    setReceiptFooterMsg(settings.receipt_footer_msg || '');
    setReceiptTerms(settings.receipt_terms || '');
    setShowQrOnReceipt(settings.show_qr_on_receipt !== '0');
    setShowLogoOnReceipt(settings.show_logo_on_receipt !== '0');
    setDefaultCharges(settings.default_charges || '1500');
    setDefaultWarrantyDays(settings.default_warranty_days || '30');
    setDefaultTurnaroundDays(settings.default_turnaround_days || '2');
    setTokenPrefix(settings.token_prefix || 'PTS');
    setTwilioSid(settings.twilio_sid || '');
    setTwilioToken(settings.twilio_token || '');
    setTwilioFrom(settings.twilio_from || '');
    setAutoBackup(settings.auto_backup === '1');
  }, [settings]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addUser({
      username: newUsername,
      name: newName,
      password: newPassword,
      role: newRole
    });

    if (res.success) {
      toast.success(`User '${newUsername}' registered successfully!`);
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewRole('Technician');
    } else {
      toast.error(res.error || 'Failed to create user account');
    }
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserPassword) return;

    const res = updateUserPassword(editingUserPassword.id, changePasswordInput);
    if (res.success) {
      toast.success(`Password for @${editingUserPassword.username} updated successfully.`);
      setEditingUserPassword(null);
      setChangePasswordInput('');
    } else {
      toast.error(res.error || 'Failed to update password');
    }
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (confirm(`Are you sure you want to remove user account '@${username}'?`)) {
      const res = deleteUser(id);
      if (res.success) {
        toast.success(`User account '@${username}' removed.`);
      } else {
        toast.error(res.error || 'Failed to remove user account.');
      }
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoPath(result);
        toast.success('Shop logo image loaded successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettingsBatch({
      shop_name: shopName,
      shop_slogan: shopSlogan,
      shop_address: shopAddress,
      shop_mobile: shopMobile,
      shop_whatsapp: shopWhatsapp,
      shop_email: shopEmail,
      logo_path: logoPath,
      thermal_size: thermalSize,
      currency_symbol: currencySymbol,
      receipt_header_msg: receiptHeaderMsg,
      receipt_footer_msg: receiptFooterMsg,
      receipt_terms: receiptTerms,
      show_qr_on_receipt: showQrOnReceipt ? '1' : '0',
      show_logo_on_receipt: showLogoOnReceipt ? '1' : '0',
      default_charges: defaultCharges,
      default_warranty_days: defaultWarrantyDays,
      default_turnaround_days: defaultTurnaroundDays,
      token_prefix: tokenPrefix,
      twilio_sid: twilioSid,
      twilio_token: twilioToken,
      twilio_from: twilioFrom,
      auto_backup: autoBackup ? '1' : '0'
    });
    toast.success('All settings saved successfully!');
  };

  const handleExportBackup = async () => {
    try {
      const binary = await exportDatabaseBinary();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const fileName = `ProTech_Database_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('SQLite database file exported successfully!');
    } catch (e) {
      toast.error('Failed to export database backup');
    }
  };

  const handleExportCSVAll = async () => {
    try {
      const [jobs, customers, inventory] = await Promise.all([
        query('SELECT * FROM jobs WHERE deleted_at IS NULL'),
        query('SELECT * FROM customers'),
        query('SELECT * FROM inventory_items')
      ]);
      exportJobsToCSV(jobs);
      exportCustomersToCSV(customers);
      exportInventoryToCSV(inventory);
      toast.success('CSV exports downloaded for all modules.');
    } catch (e) {
      toast.error('Failed to export CSV files');
    }
  };

  const handleConfirmWipe = async () => {
    if (wipeConfirmInput.toUpperCase() !== 'WIPE') {
      toast.error('Please type WIPE to confirm reset action');
      return;
    }

    try {
      setIsWiping(true);
      await resetDatabaseToProduction();
      toast.success('Database wiped clean and reset to clean production state!');
      setTimeout(() => {
        window.location.href = '/';
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error('Failed to wipe data:', err);
      toast.error('Failed to wipe system data');
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-heading">
            System & Shop Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure workshop branding, receipt templates, staff credentials, and cloud backups
          </p>
        </div>

        {/* Global Save Button */}
        <button
          onClick={handleSaveAllSettings}
          className="btn-primary py-2.5 px-5 shadow-lg shadow-slate-900/20 self-start sm:self-auto cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {[
          { id: 'identity', label: 'Shop Identity', icon: Store },
          { id: 'receipt', label: 'Receipt & Printing', icon: Printer },
          { id: 'workflow', label: 'Workflow & Defaults', icon: Wrench },
          { id: 'users', label: 'Staff Accounts', icon: Users, badge: users.length },
          { id: 'notifications', label: 'SMS & WhatsApp', icon: MessageSquare },
          { id: 'backup', label: 'Cloud Sync & Data', icon: Cloud }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Shop Identity & Branding */}
      {activeTab === 'identity' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card-container space-y-5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Store className="w-4 h-4 text-slate-500" /> Workshop Profile & Branding
            </h2>

            {/* Logo Uploader & Preview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Workshop Logo & Brand Icon
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 shadow-xs">
                  {logoPath ? (
                    <img src={logoPath} alt="Shop Logo Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <ProTechLogo className="w-12 h-12" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase mt-1">Default Logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary text-xs"
                    >
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Upload Logo Image</span>
                    </button>

                    {logoPath && (
                      <button
                        type="button"
                        onClick={() => setLogoPath('')}
                        className="btn-secondary text-xs text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove Logo</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={logoPath}
                    onChange={(e) => setLogoPath(e.target.value)}
                    placeholder="Or paste direct image URL (https://... or data:image/...)"
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Workshop Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="input-field font-semibold"
                  placeholder="e.g., ProTech Services"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Slogan / Tagline
                </label>
                <input
                  type="text"
                  value={shopSlogan}
                  onChange={(e) => setShopSlogan(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Professional Laptop & Desktop Hardware Repair"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Primary Mobile / Phone *
                </label>
                <input
                  type="text"
                  required
                  value={shopMobile}
                  onChange={(e) => setShopMobile(e.target.value)}
                  className="input-field font-mono"
                  placeholder="0300-0404004"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  WhatsApp Contact Number
                </label>
                <input
                  type="text"
                  value={shopWhatsapp}
                  onChange={(e) => setShopWhatsapp(e.target.value)}
                  className="input-field font-mono"
                  placeholder="0300-0404004"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={shopEmail}
                  onChange={(e) => setShopEmail(e.target.value)}
                  className="input-field"
                  placeholder="support@protechservices.pk"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Physical Workshop Address (Printed on Receipts)
                </label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="input-field"
                  placeholder="Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore"
                />
              </div>
            </div>
          </div>

          {/* Theme & Visual Layout Mode */}
          <div className="card-container space-y-4">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Appearance & Interface Theme
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Active System Visual Theme</p>
                <p className="text-xs text-slate-500">Toggle high-contrast dark or crisp daylight workbench appearance</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextTheme = isDark ? 'light' : 'dark';
                  toggleTheme();
                  updateSetting('theme', nextTheme);
                }}
                className="btn-secondary cursor-pointer"
              >
                {isDark ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>{isDark ? 'Dark Mode (Active)' : 'Light Mode (Active)'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 2: Receipt & Print Settings */}
      {activeTab === 'receipt' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card-container space-y-5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Printer className="w-4 h-4 text-emerald-500" /> Thermal Printer & Receipt Layout
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Default Thermal Paper Format
                </label>
                <select
                  value={thermalSize}
                  onChange={(e) => setThermalSize(e.target.value as any)}
                  className="input-field cursor-pointer"
                >
                  <option value="80">80mm Thermal POS Paper (Standard 302px Width)</option>
                  <option value="58">58mm Thermal Mini Paper (Compact 220px Width)</option>
                  <option value="a4">A4 Full Page Detailed Invoice Layout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Currency Symbol / Code
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="input-field font-bold uppercase"
                  placeholder="PKR, Rs., $, etc."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Receipt Header Note (Appears below shop name)
                </label>
                <input
                  type="text"
                  value={receiptHeaderMsg}
                  onChange={(e) => setReceiptHeaderMsg(e.target.value)}
                  className="input-field"
                  placeholder="Thank you for choosing ProTech Services for hardware repairs."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Receipt Footer Notice (Appears above QR / Signature)
                </label>
                <input
                  type="text"
                  value={receiptFooterMsg}
                  onChange={(e) => setReceiptFooterMsg(e.target.value)}
                  className="input-field"
                  placeholder="Warranty claims require original receipt. No returns after 30 days."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Terms & Conditions Printed on Receipts
                </label>
                <textarea
                  rows={4}
                  value={receiptTerms}
                  onChange={(e) => setReceiptTerms(e.target.value)}
                  className="input-field text-xs font-mono"
                  placeholder="1. Repaired equipment must be collected within 30 days.\n2. We are not responsible for software or data loss.\n3. Warranty void if seal broken."
                />
              </div>
            </div>

            {/* Receipt Toggles */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showQrOnReceipt}
                  onChange={(e) => setShowQrOnReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-900 accent-slate-900"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Print Token QR Code</span>
                  <span className="text-[11px] text-slate-500 block">Include scannable 2D QR code on thermal receipts</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLogoOnReceipt}
                  onChange={(e) => setShowLogoOnReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-900 accent-slate-900"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Print Shop Logo</span>
                  <span className="text-[11px] text-slate-500 block">Include workshop graphic logo at the top of receipts</span>
                </div>
              </label>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Workflow & Repair Defaults */}
      {activeTab === 'workflow' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card-container space-y-5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Wrench className="w-4 h-4 text-amber-500" /> Repair Operations & Intake Defaults
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Default Service Repair Charges ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={defaultCharges}
                  onChange={(e) => setDefaultCharges(e.target.value)}
                  className="input-field font-bold font-mono"
                  placeholder="1500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Token Code Sequence Prefix
                </label>
                <input
                  type="text"
                  value={tokenPrefix}
                  onChange={(e) => setTokenPrefix(e.target.value.toUpperCase())}
                  className="input-field font-bold font-mono uppercase"
                  placeholder="PTS"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Default Standard Warranty Period (Days)
                </label>
                <input
                  type="number"
                  value={defaultWarrantyDays}
                  onChange={(e) => setDefaultWarrantyDays(e.target.value)}
                  className="input-field font-bold"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Estimated Repair Turnaround (Days)
                </label>
                <input
                  type="number"
                  value={defaultTurnaroundDays}
                  onChange={(e) => setDefaultTurnaroundDays(e.target.value)}
                  className="input-field font-bold"
                  placeholder="2"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 4: Staff & User Management */}
      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card-container space-y-5 border-l-4 border-l-slate-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-heading">
                  <Users className="w-4 h-4 text-slate-500" /> Authorized Staff & Terminal User Accounts
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage workshop technicians, cashiers, and administrators with role-based access
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 rounded-full text-xs font-bold self-start sm:self-auto">
                {users.length} Active Accounts
              </span>
            </div>

            {/* Add User Form */}
            <form onSubmit={handleCreateUser} className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-slate-500" /> Register New Staff Account
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g., technician1"
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Full Staff Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Bilal Raza"
                    className="input-field text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Permission Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="input-field text-xs font-semibold cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Technician">Technician</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Superadmin">Superadmin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button type="submit" className="btn-primary text-xs py-2 px-4 cursor-pointer">
                  <UserPlus className="w-4 h-4" />
                  <span>Register Staff Member</span>
                </button>
              </div>
            </form>

            {/* Existing Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Date Registered</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isSuperadmin = u.role === 'Superadmin';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-[11px] uppercase border border-slate-500/20">
                            {u.username[0]}
                          </div>
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold uppercase">
                              Active Session
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          @{u.username}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            u.role === 'Superadmin'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                              : u.role === 'Admin'
                              ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30'
                              : u.role === 'Technician'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Change Password Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserPassword(u);
                                setChangePasswordInput('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={`Change password for @${u.username}`}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              disabled={isSelf}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              title={isSelf ? 'Cannot delete your active session' : `Delete user @${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 5: SMS & WhatsApp Notifications */}
      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card-container space-y-5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <MessageSquare className="w-4 h-4 text-slate-500" /> WhatsApp & Twilio SMS Gateway
            </h2>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> WhatsApp Direct API (Zero Setup Required)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                The application automatically opens WhatsApp Web / WhatsApp Mobile app pre-filled with customer phone, token number, repair status, and charges.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Twilio SMS API Configuration (Optional)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Account SID
                  </label>
                  <input
                    type="text"
                    value={twilioSid}
                    onChange={(e) => setTwilioSid(e.target.value)}
                    placeholder="ACXXXXXXXXXXXXXXXX"
                    className="input-field font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Auth Token
                  </label>
                  <input
                    type="password"
                    value={twilioToken}
                    onChange={(e) => setTwilioToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="input-field font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Sender Phone / Shortcode
                  </label>
                  <input
                    type="text"
                    value={twilioFrom}
                    onChange={(e) => setTwilioFrom(e.target.value)}
                    placeholder="+1234567890"
                    className="input-field font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 6: Cloud Sync, Backups & Factory Reset */}
      {activeTab === 'backup' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Google Drive Zero-API Desktop Sync */}
          <SyncSettingsComponent />

          {/* Quick Database Backup & Data Export */}
          <div className="card-container space-y-4">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Database className="w-4 h-4 text-slate-500" /> Database File & Spreadsheet Exports
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase">Download SQLite Database</h3>
                    <p className="text-[11px] text-slate-500">Export standalone .db binary with full tables</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full btn-secondary text-xs py-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .db Backup File</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase">Export CSV Spreadsheets</h3>
                    <p className="text-[11px] text-slate-500">Download Excel-ready CSVs for Jobs, Customers & Inventory</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSVAll}
                  className="w-full btn-secondary text-xs py-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export All Modules to CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* ADMIN DATA WIPE & FACTORY RESET */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                  Admin Maintenance: Production State Reset & Data Wipe
                </h2>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  Permanently erase all repair jobs, customer profiles, payment ledger entries, and reset database back to a clean production state.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsWipeModalOpen(true)}
                className="btn-danger cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Wipe Data & Reset to Clean Production</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {editingUserPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingUserPassword(null)}
            className="fixed inset-0 z-50 bg-slate-950/70  flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Update Account Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    User: @{editingUserPassword.username} ({editingUserPassword.name})
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    New Access Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={changePasswordInput}
                    onChange={(e) => setChangePasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="input-field text-sm font-mono"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUserPassword(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Save className="w-4 h-4" />
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM WIPE MODAL */}
      <AnimatePresence>
        {isWipeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsWipeModalOpen(false);
              setWipeConfirmInput('');
            }}
            className="fixed inset-0 z-50 bg-slate-950/70  flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Confirm Production Reset</h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Irreversible Action</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <p>
                  This action will permanently wipe all local database tables including customer directory, active repair tickets, income logs, and inventory items.
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  To confirm factory wipe, please type <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">WIPE</span> below:
                </p>
              </div>

              <input
                type="text"
                value={wipeConfirmInput}
                onChange={(e) => setWipeConfirmInput(e.target.value)}
                placeholder="Type WIPE"
                className="input-field font-mono font-bold uppercase border-rose-300 dark:border-rose-700 text-center text-sm"
                autoFocus
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWipeModalOpen(false);
                    setWipeConfirmInput('');
                  }}
                  disabled={isWiping}
                  className="btn-secondary"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmWipe}
                  disabled={isWiping || wipeConfirmInput.toUpperCase() !== 'WIPE'}
                  className="btn-danger"
                >
                  {isWiping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Wiping Software...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm Production Reset</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
