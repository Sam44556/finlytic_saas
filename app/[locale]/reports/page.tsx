"use client"

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, Upload, Eye, Lock } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";

type ReportOption = 'pdf' | 'csv' | 'import' | null;

function ReportsContent() {
  const t = useTranslations('reports');
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) || 'en';
  
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [selectedOption, setSelectedOption] = useState<ReportOption>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Generate last 12 months for period dropdown
  const generateMonthOptions = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(format(date, "MMMM yyyy"));
    }
    return months;
  };

  const monthOptions = generateMonthOptions();

  // Fetch user's subscription tier
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.log('No token available');
          setIsLoadingProfile(false);
          return;
        }

        console.log('Fetching profile with token...');
        const response = await fetch('/api/profiles', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Profile response:', result);
          
          // The API returns { data: { ...profile } }
          const profileData = result.data || result;
          console.log('Profile data:', profileData);
          console.log('Subscription tier:', profileData?.subscription_tier);
          
          setSubscriptionTier(profileData?.subscription_tier || 'free');
        } else {
          console.error('Failed to fetch profile:', response.status);
          setSubscriptionTier('free');
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setSubscriptionTier('free');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [getToken]);

  const handleOptionClick = (option: ReportOption) => {
    console.log('Current subscription tier:', subscriptionTier);
    
    // Check if user has pro or lifetime subscription
    if (subscriptionTier === 'free' || subscriptionTier === null) {
      // Show upgrade dialog
      const confirmed = window.confirm(
        'Reports feature is only available for Pro and Lifetime subscribers.\n\n' +
        'Upgrade now to unlock:\n' +
        '• PDF Report Export\n' +
        '• CSV Export\n' +
        '• CSV Import\n' +
        '• AI-powered insights\n\n' +
        'Click OK to view subscription plans.'
      );
      
      if (confirmed) {
        router.push(`/${locale}/subscription`);
      }
      return;
    }

    setSelectedOption(option);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsLoading(false);
  };

  // PDF Form State
  const [pdfType, setPdfType] = useState("Report");
  const [pdfPeriod, setPdfPeriod] = useState(format(new Date(), "MMMM yyyy"));
  const [pdfIncludeIncome, setPdfIncludeIncome] = useState(true);
  const [pdfIncludeExpenses, setPdfIncludeExpenses] = useState(true);
  const [pdfIncludeBudgets, setPdfIncludeBudgets] = useState(true);

  // CSV Form State
  const [csvSeparator, setCsvSeparator] = useState(";");
  const [csvFromDate, setCsvFromDate] = useState("01.04.2026");
  const [csvToDate, setCsvToDate] = useState("30.04.2026");
  const [csvQuickSelect, setCsvQuickSelect] = useState("Last month");
  const [csvIncludeIncome, setCsvIncludeIncome] = useState(true);
  const [csvIncludeExpenses, setCsvIncludeExpenses] = useState(true);
  const [csvIncludeTransfers, setCsvIncludeTransfers] = useState(false);

  // Import Form State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDateFormat, setImportDateFormat] = useState("13/05/2026");
  const [importHeaderPresent, setImportHeaderPresent] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsLoading(true);

      const token = await getToken();
      if (!token) {
        alert('Please sign in first');
        setIsLoading(false);
        return;
      }

      const exportData = {
        type: pdfType,
        period: pdfPeriod,
        includes: {
          income: pdfIncludeIncome,
          expenses: pdfIncludeExpenses,
          budgets: pdfIncludeBudgets
        }
      };

      console.log('Exporting report:', exportData);

      const response = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        let message = 'Failed to export report';
        try {
          const err = await response.json();
          message = typeof err?.error === 'string' ? err.error : message;
        } catch {
          message = response.status === 401 ? 'Unauthorized — try signing out and back in.' : message;
        }
        throw new Error(message);
      }

      const htmlContent = await response.text();
      const blob = new Blob(['\uFEFF', htmlContent], { type: 'text/html;charset=utf-8' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${pdfPeriod.replace(/\s+/g, '-')}.html`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      closeDialog();
      alert('Report downloaded as HTML. Open it in your browser; use Print (Ctrl+P) → Save as PDF if you want a PDF file.');
    } catch (error: any) {
      console.error('PDF Export Error:', error);
      alert('Failed to export PDF: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        alert('Please sign in first');
        setIsLoading(false);
        return;
      }

      const exportData = {
        separator: csvSeparator,
        fromDate: csvFromDate,
        toDate: csvToDate,
        includes: {
          income: csvIncludeIncome,
          expenses: csvIncludeExpenses,
          transfers: csvIncludeTransfers
        }
      };

      console.log('Exporting CSV with:', exportData);

      const response = await fetch('/api/reports/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export CSV');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${csvFromDate}-to-${csvToDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      closeDialog();
      alert('CSV file exported successfully!');
    } catch (error: any) {
      console.error('CSV Export Error:', error);
      alert('Failed to export CSV: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleImportFile = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        alert('Please sign in first');
        setIsLoading(false);
        return;
      }

      if (!importFile) {
        alert('Please select a file first');
        setIsLoading(false);
        return;
      }

      console.log('Importing file:', {
        file: importFile.name,
        dateFormat: importDateFormat,
        headerPresent: importHeaderPresent
      });

      // Create form data
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('dateFormat', importDateFormat);
      formData.append('headerPresent', String(importHeaderPresent));

      const response = await fetch('/api/reports/import-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import file');
      }

      closeDialog();
      
      // Show success message with summary
      alert(`✅ Import Successful!\n\n` +
        `Total Imported: ${result.summary.totalImported} transactions\n` +
        `Income: ${result.summary.incomeTransactions} transactions ($${result.summary.totalIncome})\n` +
        `Expenses: ${result.summary.expenseTransactions} transactions ($${result.summary.totalExpenses})\n` +
        `Net Amount: $${result.summary.netAmount}\n\n` +
        `Please refresh the page to see your imported transactions.`);
      
      // Reset file input
      setImportFile(null);
      
      // Optionally reload the page to show new transactions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Import Error:', error);
      alert('Failed to import file: ' + error.message);
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoadingProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isFreeUser = !subscriptionTier || subscriptionTier === 'free';
  
  console.log('Is free user?', isFreeUser, 'Tier:', subscriptionTier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {isFreeUser 
            ? '🔒 Upgrade to Pro or Lifetime to unlock Reports features' 
            : 'Export and import your financial data'}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Export PDF Button */}
        <Card 
          className={`p-8 cursor-pointer transition-all ${isFreeUser ? 'opacity-60 hover:opacity-80' : 'hover:shadow-lg'}`}
          onClick={() => handleOptionClick('pdf')}
        >
          <div className="flex items-start gap-6">
            <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 relative">
              <FileDown className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              {isFreeUser && (
                <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                  <Lock className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-medium mb-2">
                {t('exportPdf')}
                {isFreeUser && <span className="ml-2 text-primary text-sm">• Pro Feature</span>}
              </h3>
              <p className="text-muted-foreground">{t('exportPdfDesc')}</p>
            </div>
          </div>
        </Card>

        {/* Export CSV Button */}
        <Card 
          className={`p-8 cursor-pointer transition-all ${isFreeUser ? 'opacity-60 hover:opacity-80' : 'hover:shadow-lg'}`}
          onClick={() => handleOptionClick('csv')}
        >
          <div className="flex items-start gap-6">
            <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 relative">
              <FileDown className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              {isFreeUser && (
                <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                  <Lock className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-medium mb-2">
                {t('exportCsv')}
                {isFreeUser && <span className="ml-2 text-primary text-sm">• Pro Feature</span>}
              </h3>
              <p className="text-muted-foreground">{t('exportCsvDesc')}</p>
            </div>
          </div>
        </Card>

        {/* Import CSV/XLS Button */}
        <Card 
          className={`p-8 cursor-pointer transition-all ${isFreeUser ? 'opacity-60 hover:opacity-80' : 'hover:shadow-lg'}`}
          onClick={() => handleOptionClick('import')}
        >
          <div className="flex items-start gap-6">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 relative">
              <Upload className="h-8 w-8 text-primary" />
              {isFreeUser && (
                <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                  <Lock className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-medium mb-2">
                {t('importCsv')}
                {isFreeUser && <span className="ml-2 text-primary text-sm">• Pro Feature</span>}
              </h3>
              <p className="text-muted-foreground">{t('importCsvDesc')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Dialog for Forms */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {/* PDF Export Form */}
          {selectedOption === 'pdf' && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-medium text-center mb-6">{t('createFilePdf')}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Type */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="text-base">{t('type')}</Label>
                  <Select value={pdfType} onValueChange={setPdfType}>
                    <SelectTrigger>
                      <SelectValue>{pdfType}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Report">{t('report')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Period */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="text-base">{t('period')}</Label>
                  <Select value={pdfPeriod} onValueChange={setPdfPeriod}>
                    <SelectTrigger>
                      <SelectValue>{pdfPeriod}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Include reports on */}
                <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                  <Label className="text-base pt-2">{t('includeReportsOn')}</Label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfIncludeIncome}
                        onChange={(e) => setPdfIncludeIncome(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-base">{t('income')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfIncludeExpenses}
                        onChange={(e) => setPdfIncludeExpenses(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-base">{t('expenses')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfIncludeBudgets}
                        onChange={(e) => setPdfIncludeBudgets(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-base">{t('budgets')}</span>
                    </label>
                  </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleExportPdf}
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-medium rounded-full disabled:opacity-50"
                  >
                    {isLoading ? 'Generating PDF...' : t('exportPdfFileBtn')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* CSV Export Form */}
          {selectedOption === 'csv' && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-medium text-center mb-6">{t('exportCsvFile')}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Separator */}
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-base">{t('separator')}</Label>
                  <Input
                    value={csvSeparator}
                    onChange={(e) => setCsvSeparator(e.target.value)}
                    className="max-w-[240px]"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-base">{t('from')}</Label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Input
                      value={csvFromDate}
                      onChange={(e) => setCsvFromDate(e.target.value)}
                      className="max-w-[180px]"
                    />
                    <Label className="text-base">{t('to')}</Label>
                    <Input
                      value={csvToDate}
                      onChange={(e) => setCsvToDate(e.target.value)}
                      className="max-w-[180px]"
                    />
                    <Select value={csvQuickSelect} onValueChange={setCsvQuickSelect}>
                      <SelectTrigger className="max-w-[200px]">
                        <SelectValue>{csvQuickSelect}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Last month">{t('lastMonth')}</SelectItem>
                        <SelectItem value="This month">{t('thisMonth')}</SelectItem>
                        <SelectItem value="Last 3 months">{t('last3Months')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Include transactions */}
                <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                  <Label className="text-base pt-2">{t('includeTransactions')}</Label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={csvIncludeIncome}
                        onChange={(e) => setCsvIncludeIncome(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-base">{t('income')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={csvIncludeExpenses}
                        onChange={(e) => setCsvIncludeExpenses(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-base">{t('expenses')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={csvIncludeTransfers}
                        onChange={(e) => setCsvIncludeTransfers(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-gray-400"
                      />
                      <span className="text-base">{t('transfersAndPayments')}</span>
                    </label>
                  </div>
                </div>

                {/* Other Section */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-5 w-5" />
                  <span className="text-base font-medium">{t('other')}</span>
                </div>

                {/* Export Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleExportCsv}
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-medium rounded-full disabled:opacity-50"
                  >
                    {isLoading ? 'Exporting CSV...' : t('exportCsvFileBtn')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Import CSV/XLS Form */}
          {selectedOption === 'import' && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-medium text-center mb-6">{t('importCsvXlsFile')}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* File Upload */}
                <div className="flex items-center gap-4">
                  <label 
                    htmlFor="file-upload"
                    className="px-6 py-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('chooseFile')}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-muted-foreground">
                    {importFile ? importFile.name : t('noFileChosen')}
                  </span>
                </div>

                {/* Date Format */}
                <div className="flex items-center gap-4">
                  <Label className="text-base">{t('dateFormat')}</Label>
                  <Input
                    value={importDateFormat}
                    onChange={(e) => setImportDateFormat(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <span className="text-muted-foreground">{t('today')}</span>
                </div>

                {/* Header Row Present */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importHeaderPresent}
                      onChange={(e) => setImportHeaderPresent(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-base">{t('headerRowPresent')}</span>
                  </label>
                </div>

                {/* FAQ Link */}
                <div className="text-center pt-4">
                  <a 
                    href="#" 
                    className="text-primary hover:underline text-base"
                  >
                    {t('frequentlyAskedQuestions')}
                  </a>
                </div>

                {/* Import Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleImportFile}
                    disabled={!importFile || isLoading}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-medium rounded-full disabled:opacity-50"
                  >
                    {isLoading ? 'Importing...' : t('importCsvXlsFileBtn')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ReportsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
