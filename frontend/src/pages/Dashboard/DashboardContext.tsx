import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchDashboard, type DashboardResDto } from '../../lib/api';
import { useThrowAsyncError } from '../../lib/use-throw-async-error';

type DashboardContextType = {
  dashboard: DashboardResDto | null;
  setDashboard: (dashboard: DashboardResDto) => void;
  period: Date | null;
  handlePeriodChange: (date: string) => void;
  pdfRef: RefObject<HTMLDivElement | null>;
  onDownloadPdf: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashoboardProvider = ({ children }: { children: React.ReactNode }) => {
  const throwAsync = useThrowAsyncError();
  const [dashboard, setDashboard] = useState<DashboardResDto | null>(null);
  const [period, setPeriod] = useState<Date>(new Date());
  const pdfRef = useRef<HTMLDivElement>(null);

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

  const onDownloadPdf = async () => {
    const input = pdfRef.current;
    if (!input) return;
    const canvas = await html2canvas(input, {
      scale: 2,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4',
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    pdf.save(`financial-statement-${period.toISOString()}.pdf`);
  };

  return (
    <DashboardContext.Provider
      value={{
        dashboard,
        setDashboard,
        period,
        handlePeriodChange,
        pdfRef,
        onDownloadPdf,
      }}
    >
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
