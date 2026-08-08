import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Settings,
  Save,
  Store,
  Printer,
  Moon,
  Sun,
  Upload,
  Trash2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Image as ImageIcon,
  Laptop,
  Cpu,
  Wrench,
  Shield,
  Server,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/settings';
import { useTheme } from '../../hooks/useTheme';
import { useUpdater } from '../../hooks/useUpdater';
import { resetDatabaseToProduction } from '../../lib/db';
import { ProTechLogo } from '../../components/shared/ProTechLogo';
import { SyncSettingsComponent } from '../../components/sync/SyncSettingsComponent';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettingsBatch, updateSetting } = useSettingsStore();
  const updater = useUpdater();
  const updateStatusText =
    updater.state === 'checking'
      ? 'Checking for updates…'
      : updater.state === 'available' || updater.state === 'downloading'
        ? `Downloading update… ${updater.percent}%`
        : updater.state === 'downloaded'
          ? 'Update ready — restart to install.'
          : updater.state === 'uptodate'
            ? 'You are on the latest version.'
            : updater.state === 'error'
              ? 'Update check failed.'
              : 'New versions are checked automatically on launch.';
  const { isDark, toggleTheme } = useTheme('dark');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [shopName, setShopName] = useState(settings.shop_name);
  const [shopAddress, setShopAddress] = useState(settings.shop_address);
  const [shopMobile, setShopMobile] = useState(settings.shop_mobile);
  const [logoPath, setLogoPath] = useState(settings.logo_path || '');
  const [thermalSize, setThermalSize] = useState<'58' | '80'>(settings.thermal_size as '58' | '80');
  const [defaultCharges, setDefaultCharges] = useState(settings.default_charges);
  const [autoBackup, setAutoBackup] = useState(settings.auto_backup === '1');

  // Admin Data Wipe state
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    setShopName(settings.shop_name);
    setShopAddress(settings.shop_address);
    setShopMobile(settings.shop_mobile);
    setLogoPath(settings.logo_path || '');
    setThermalSize((settings.thermal_size as '58' | '80') || '80');
    setDefaultCharges(settings.default_charges);
    setAutoBackup(settings.auto_backup === '1');
  }, [settings]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettingsBatch({
      shop_name: shopName,
      shop_address: shopAddress,
      shop_mobile: shopMobile,
      logo_path: logoPath,
      thermal_size: thermalSize,
      default_charges: defaultCharges,
      auto_backup: autoBackup ? '1' : '0'
    });
    toast.success('Shop settings updated successfully!');
  };

  const handleConfirmWipe = async () => {
    if (wipeConfirmInput.toUpperCase() !== 'WIPE') {
      toast.error('Please type WIPE to confirm reset action');
      return;
    }

    try {
      setIsWiping(true);
      await resetDatabaseToProduction();
      toast.success('Software wiped clean and reset to production state!');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Shop Settings & Configuration</h1>
        <p className="text-xs text-slate-500">Manage repair center branding, logo, receipt printing, and administrative data controls</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Shop Identity & Logo Section */}
        <div className="card-container space-y-5">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Store className="w-4 h-4 text-blue-500" /> Shop Identity & Branding
          </h2>

          {/* Logo Uploader & Preview */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              Shop Logo / Badge
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Logo Preview Box */}
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 shadow-xs relative group">
                {logoPath ? (
                  <img src={logoPath} alt="Shop Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <ProTechLogo className="w-12 h-12" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase mt-1">Default Logo</span>
                  </div>
                )}
              </div>

              {/* Upload & Controls */}
              <div className="space-y-2 w-full">
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
                    className="btn-secondary"
                  >
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span>Upload Image</span>
                  </button>

                  {logoPath && (
                    <button
                      type="button"
                      onClick={() => setLogoPath('')}
                      className="btn-secondary text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>

                {/* Optional Image URL Input */}
                <div>
                  <input
                    type="text"
                    value={logoPath}
                    onChange={(e) => setLogoPath(e.target.value)}
                    placeholder="Or paste image URL (https://... or data:image/...)"
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Shop Name / Title *
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="input-field font-semibold"
                placeholder="e.g., ProData Repair Center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Shop Contact Mobile *
              </label>
              <input
                type="text"
                required
                value={shopMobile}
                onChange={(e) => setShopMobile(e.target.value)}
                className="input-field"
                placeholder="+92 300 1234567"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Shop Address (Printed on Receipts & Job Cards)
              </label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className="input-field"
                placeholder="Main Service Center, Plaza Street, City"
              />
            </div>
          </div>
        </div>

        {/* Printing & Default Preferences */}
        <div className="card-container space-y-4">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Printer className="w-4 h-4 text-emerald-500" /> Thermal Receipt Printer & Default Charges
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Default Thermal Paper Size
              </label>
              <select
                value={thermalSize}
                onChange={(e) => setThermalSize(e.target.value as '58' | '80')}
                className="input-field"
              >
                <option value="80">80mm Thermal Printer Paper (302px Width)</option>
                <option value="58">58mm Thermal Printer Paper (220px Width)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Default Service Repair Charges (PKR)
              </label>
              <input
                type="number"
                value={defaultCharges}
                onChange={(e) => setDefaultCharges(e.target.value)}
                className="input-field font-bold"
              />
            </div>
          </div>
        </div>

        {/* Software Updates */}
        <div className="card-container space-y-4">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
            Software Updates
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Application Updates</p>
              <p className="text-xs text-slate-500">{updateStatusText}</p>
              {updater.error && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono break-words">{updater.error}</p>
              )}
            </div>

            {updater.state === 'downloaded' ? (
              <button
                type="button"
                onClick={updater.install}
                className="btn-primary"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart & Install</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => updater.check(true)}
                disabled={updater.state === 'checking' || updater.state === 'downloading'}
                className="btn-secondary"
              >
                <RefreshCw
                  className={`w-4 h-4 ${updater.state === 'checking' ? 'animate-spin' : ''}`}
                />
                <span>Check for Updates</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Updates are downloaded from a self-hosted feed configured at build time
            (or via the <code className="font-mono">UPDATE_FEED_URL</code> environment variable).
            Checks are silent when offline; portable builds update by downloading a new
            portable version manually.
          </p>
        </div>

        {/* Theme Preferences */}
        <div className="card-container space-y-4">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
            Appearance Mode
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Application Dark/Light Theme</p>
              <p className="text-xs text-slate-500">Adjust active color scheme across user interface components</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextTheme = isDark ? 'light' : 'dark';
                toggleTheme();
                updateSetting('theme', nextTheme);
              }}
              className="btn-secondary"
            >
              {isDark ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>{isDark ? 'Dark Mode (Active)' : 'Light Mode (Active)'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="btn-primary px-6"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* GOOGLE DRIVE ZERO-API AUTOMATIC BACKUP SYNC */}
      <SyncSettingsComponent />

      {/* ADMIN DATA WIPE & FACTORY RESET SECTION */}
      <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-6 space-y-4 mt-8">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-lg text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
              Admin Zone: Production State Reset & Data Wipe
            </h2>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              Permanently erase all repair jobs, customer directory logs, notifications, and reset software parameters back to pristine clean factory defaults.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setIsWipeModalOpen(true)}
            className="btn-danger"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Wipe Data & Reset to Production</span>
          </button>
        </div>
      </div>

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
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
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
                  This action will permanently wipe all internal databases including customer cards, active repair tickets, income logs, and custom settings.
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

