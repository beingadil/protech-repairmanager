import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, Search, Plus, Check } from 'lucide-react';
import { query } from '../../lib/db';
import { Customer } from '../../types/customer';

interface CustomerAutocompleteProps {
  onSelectCustomer: (customer: Customer | null) => void;
  onCustomerDetailsChange: (name: string, mobile: string, address: string) => void;
  initialName?: string;
  initialMobile?: string;
  initialAddress?: string;
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  onSelectCustomer,
  onCustomerDetailsChange,
  initialName = '',
  initialMobile = '',
  initialAddress = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialName);
  const [mobile, setMobile] = useState(initialMobile);
  const [address, setAddress] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  useEffect(() => {
    if (searchTerm.trim().length >= 2 && !selectedCustomerId) {
      query<Customer>(
        'SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ? ORDER BY name ASC LIMIT 6',
        [`%${searchTerm}%`, `%${searchTerm}%`]
      ).then((res) => {
        setSuggestions(res);
        setIsOpen(res.length > 0);
      });
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [searchTerm, selectedCustomerId]);

  const handleSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSearchTerm(customer.name);
    setMobile(customer.mobile || '');
    setAddress(customer.address || '');
    setIsOpen(false);
    onSelectCustomer(customer);
    onCustomerDetailsChange(customer.name, customer.mobile || '', customer.address || '');
  };

  const handleNameChange = (val: string) => {
    setSearchTerm(val);
    setSelectedCustomerId(null);
    onSelectCustomer(null);
    onCustomerDetailsChange(val, mobile, address);
  };

  const handleMobileChange = (val: string) => {
    setMobile(val);
    onCustomerDetailsChange(searchTerm, val, address);
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    onCustomerDetailsChange(searchTerm, mobile, val);
  };

  return (
    <div className="space-y-4">
      {/* Customer Name Autocomplete */}
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          Customer Name *
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            required
            value={searchTerm}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Type customer name or mobile..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-transparent outline-none dark:text-white"
          />
          {selectedCustomerId && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 flex items-center text-xs font-medium gap-1">
              <Check className="w-4 h-4" /> Selected
            </span>
          )}
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {suggestions.map((cust) => (
              <button
                type="button"
                key={cust.id}
                onClick={() => handleSelect(cust)}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cust.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {cust.mobile || 'No Phone'}
                  </p>
                </div>
                <span className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                  Existing
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile & Address fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Mobile Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              required
              value={mobile}
              onChange={(e) => handleMobileChange(e.target.value)}
              placeholder="03001234567"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-transparent outline-none dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Address / City
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Gulberg, Lahore"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-transparent outline-none dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
