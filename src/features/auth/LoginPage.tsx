import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, User, Eye, EyeOff, LogIn, AlertCircle, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/auth';
import { useSettingsStore } from '../../store/settings';
import { ProTechLogo } from '../../components/shared/ProTechLogo';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const { settings } = useSettingsStore();

  const [rememberUsername, setRememberUsername] = useState<boolean>(() => {
    return !!localStorage.getItem('protech_remembered_username');
  });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('protech_remembered_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect target after login
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    if (rememberUsername && username.trim()) {
      localStorage.setItem('protech_remembered_username', username.trim());
    } else {
      localStorage.removeItem('protech_remembered_username');
    }

    setTimeout(() => {
      const res = login(username, password);
      setIsSubmitting(false);

      if (res.success) {
        toast.success(`Welcome, ${username}! System unlocked.`);
        navigate(from, { replace: true });
      } else {
        setErrorMsg(res.error || 'Authentication failed. Please check credentials.');
        toast.error('Invalid credentials');
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6"
      >
        {/* Top Shop Identity Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            {settings.logo_path ? (
              <img
                src={settings.logo_path}
                alt="Shop Logo"
                className="w-16 h-16 rounded-2xl object-contain bg-slate-800 p-2 border border-slate-700 shadow-lg"
              />
            ) : (
              <div className="p-3 bg-blue-600/15 rounded-2xl border border-blue-500/30 text-blue-400">
                <ProTechLogo className="w-12 h-12" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-tight font-heading">
              {settings.shop_name || 'ProTech Repair Center'}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Authorized Repair Management & Terminal Access
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 font-semibold flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Account Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-800 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Access Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/80 border border-slate-800 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Username Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 font-medium cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-2 focus:ring-blue-500/20 cursor-pointer accent-blue-600"
              />
              <span className="group-hover:text-white transition-colors">Remember Username</span>
            </label>

            <button
              type="button"
              onClick={() => setRememberUsername(!rememberUsername)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                rememberUsername
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>{rememberUsername ? 'Saved' : 'Remember'}</span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 border border-blue-500/50"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Terminal'}</span>
          </button>
        </form>

        {/* Footer Security Note */}
        <div className="text-center pt-2 border-t border-slate-800/80">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Encrypted Station Session • Offline SQLite Database
          </p>
        </div>
      </motion.div>
    </div>
  );
};
