import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MoneyText } from '../../components/ui/MoneyText';
import { SkeletonList } from '../../components/ui/Skeleton';
import { AccountFlowRow } from '../../lib/finance';
import { useFinanceData } from './hooks/useFinanceData';

interface ReportsTabProps {
  finance: ReturnType<typeof useFinanceData>;
}

/**
 * Reports tab — per-account money flows (chart of accounts activity) with an
 * optional date range. One SQL source (loadAccountFlows) feeds the whole view.
 */
export const ReportsTab: React.FC<ReportsTabProps> = ({ finance }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const load = async (f = from, t = to) => {
    setIsLoading(true);
    await finance.loadAccountFlows(f || undefined, t || undefined);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = (rows: AccountFlowRow[], type: string) =>
    rows.filter((r) => r.type === type).reduce((acc, r) => acc + r.total_debit, 0);

  const income = totals(finance.accountFlows, 'income');
  const expense = totals(finance.accountFlows, 'expense');
  const net = income - expense;

  return (
    <div className="space-y-4">
      <div className="card-container p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="form-label">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="form-label">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-field"
          />
        </div>
        <Button onClick={() => load()} loading={isLoading}>
          Apply Range
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setFrom('');
            setTo('');
            load('', '');
          }}
        >
          All Time
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-container p-4">
          <p className="kpi-label">Total Income</p>
          <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-heading mt-1">
            <MoneyText amount={income} />
          </h3>
        </div>
        <div className="card-container p-4">
          <p className="kpi-label">Total Expense</p>
          <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 font-heading mt-1">
            <MoneyText amount={expense} />
          </h3>
        </div>
        <div className="card-container p-4">
          <p className="kpi-label">Net Position</p>
          <h3
            className={`text-xl font-black font-heading mt-1 ${
              net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <MoneyText amount={net} />
          </h3>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : finance.accountFlows.length === 0 ? (
        <div className="card-container">
          <EmptyState
            icon={<BarChart3 className="w-5 h-5" />}
            title="No account activity in this range"
            description="Post vouchers to see per-account flows here."
          />
        </div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="table-header">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Debit (Out)</th>
                <th className="py-3 px-4 text-right">Credit (In)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {finance.accountFlows.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                    {r.code}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {r.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <MoneyText amount={r.total_debit} tone="negative" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <MoneyText amount={r.total_credit} tone="positive" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportsTab;
