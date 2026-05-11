import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  createSharableStatement,
  fetchDashboard,
  fetchSharableStatement,
  type DashboardResDto,
} from '../../lib/api';
import { useThrowAsyncError } from '../../lib/use-throw-async-error';
import { useAuth } from '../../lib/auth-context';
import type { User } from '../../lib/auth';

const FE_APP_BASE_URL: string =
  import.meta.env.VITE_FE_APP_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

type DashboardContextType = {
  dashboard: DashboardResDto | null;
  setDashboard: (dashboard: DashboardResDto) => void;
  period: Date | null;
  handlePeriodChange: (date: string) => void;
  pdfRef: RefObject<HTMLDivElement | null>;
  onDownloadPdf: () => Promise<void>;
  sharableUrl: string | null;
  shareError: string | null;
  isSharing: boolean;
  onShareStatement: () => Promise<void>;
  onDismissSharableUrl: () => void;
  user: User | null;
  isShared: boolean;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

type DashboardProviderProps = {
  children: React.ReactNode;
  shareToken?: string;
};

export const DashoboardProvider = ({ children, shareToken }: DashboardProviderProps) => {
  const throwAsync = useThrowAsyncError();
  const { user: authUser } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResDto | null>(null);
  const [period, setPeriod] = useState<Date>(new Date());
  const [sharableUrl, setSharableUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [sharedUser, setSharedUser] = useState<User | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const isShared = Boolean(shareToken);

  const getPeriodQueryParts = (): { month: string; year: string } => {
    const year = period.getFullYear().toString();
    const m = period.getMonth() + 1;
    const month = m < 10 ? `0${m}` : m.toString();
    return { month, year };
  };

  useEffect(() => {
    let cancelled = false;

    if (shareToken) {
      fetchSharableStatement(shareToken)
        .then((response) => {
          if (cancelled) return;
          setDashboard(response.data);
          setSharedUser(response.user);
          setPeriod(new Date(response.createdAt));
        })
        .catch((error: unknown) => {
          if (!cancelled) throwAsync(error);
        });
      return () => {
        cancelled = true;
      };
    }

    const qsYear = period.getFullYear().toString();
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
  }, [throwAsync, period, shareToken]);

  const handlePeriodChange = (periodStr: string) => {
    setDashboard(null);
    setSharableUrl(null);
    setShareError(null);
    setPeriod(new Date(periodStr));
  };

  const onShareStatement = async () => {
    setIsSharing(true);
    setShareError(null);
    setSharableUrl(null);
    try {
      const { month, year } = getPeriodQueryParts();
      const { token } = await createSharableStatement(month, year);
      setSharableUrl(`${FE_APP_BASE_URL}/sharable-statement/${token}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share statement.';
      setShareError(message);
    } finally {
      setIsSharing(false);
    }
  };

  const onDismissSharableUrl = () => {
    setSharableUrl(null);
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
        sharableUrl,
        shareError,
        isSharing,
        onShareStatement,
        onDismissSharableUrl,
        user: isShared ? sharedUser : authUser,
        isShared,
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
