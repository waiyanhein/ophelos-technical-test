import { createContext, useContext, useEffect, useState } from 'react';
import { fetchDashboard, type DashboardResDto } from '../../lib/api';
import { useThrowAsyncError } from '../../lib/use-throw-async-error';

type DashboardContextType = {
  dashboard: DashboardResDto | null;
  setDashboard: (dashboard: DashboardResDto) => void;
  period: Date | null;
  handlePeriodChange: (date: string) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashoboardProvider = ({ children }: { children: React.ReactNode }) => {
  const throwAsync = useThrowAsyncError();
  const [dashboard, setDashboard] = useState<DashboardResDto | null>(null);
  const [period, setPeriod] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    const qsYear = period.getFullYear().toString();
    // pad 0 if needed
    const month = period.getMonth() + 1;
    const qsMonth = month < 10 ? `0${month}` : month.toString();
    fetchDashboard(qsMonth, qsYear)
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) throwAsync(error);
      });
    return () => {
      cancelled = true;
    };
  }, [throwAsync, period]);

  const handlePeriodChange = (periodStr: string) => {
    setDashboard(null);
    setPeriod(new Date(periodStr));
  };

  return (
    <DashboardContext.Provider value={{ dashboard, setDashboard, period, handlePeriodChange }}>
      {children}
    </DashboardContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
