import React, { useMemo, useState } from 'react';
import { Checklist, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import Button from '../shared/Button';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { generateAuditReportPDF } from '../../services/pdfService';
import { turso } from '../../services/tursoClient';
import { uploadPublic } from '../../services/storageClient';
import { sendWhatsAppMessage } from '../../services/whatsappClient';

// Get API base URL from environment
const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';

const ReportsView: React.FC<ReportsViewProps> = ({ checklists, users }) => {
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);

  // Helper to get API URL (prefers relative path in production/Vercel)
  const getApiUrl = (path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname === 'localhost')) {
      return cleanPath;
    }
    return `${apiBaseUrl}${cleanPath}`;
  };

  const completedAudits = useMemo(() => {
    return checklists
      .filter(c => c.status === 'completed' && c.report_url)
      .sort((a, b) => new Date(b.check_out_time!).getTime() - new Date(a.check_out_time!).getTime());
  }, [checklists]);

  const handleDownloadReport = async (audit: Checklist) => {
    if (!audit.report_url) return;

    setDownloadingId(audit.id);
    try {
      // Request presigned URL from server
      const response = await fetch(getApiUrl('/api/report-download'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportPath: audit.report_url }),
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMessage = 'Failed to get download link';
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          console.error('Server error (HTML):', text);
        }
        throw new Error(errorMessage);
      }

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Unexpected response format:', text);
        throw new Error('Server returned invalid response format. Please try again later.');
      }

      const { presignedUrl } = await response.json();

      // Download the file using the presigned URL
      const downloadLink = document.createElement('a');
      downloadLink.href = presignedUrl;
      downloadLink.download = `${audit.title}.pdf`;
      downloadLink.click();
    } catch (error: any) {
      console.error('Failed to download report:', error);
      alert(`Failed to download report: ${error.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRegenerateReport = async (audit: Checklist) => {
    if (isRegenerating) return;
    
    const confirmRegen = window.confirm("Are you sure you want to regenerate this report? This will attempt to re-fetch all photos and create a new PDF.");
    if (!confirmRegen) return;

    setIsRegenerating(audit.id);
    try {
      const auditor = audit.assigned_to ? userMap.get(audit.assigned_to) : null;
      const logoUrl = (import.meta as any).env?.VITE_LOGO_URL || "https://pub-9d01db2ebda64069a7e7fd1f530e753e.r2.dev/viLjdYG8hKmB34Y0CZFvFTm8BWcavvRr5B05IUl1__1_-removebg-preview%20(1).png";
      
      // 1. Generate new PDF
      const pdfBlob = await generateAuditReportPDF(audit, auditor || null, logoUrl);

      // 2. Upload new PDF
      const auditorName = auditor?.name?.replace(/\s+/g, '_') || 'Auditor';
      const locationName = audit.location?.replace(/\s+/g, '_') || 'Location';
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `reports/${auditorName}_${locationName}_${dateStr}_${audit.id.slice(0, 6)}_regen.pdf`;

      const newReportUrl = await uploadPublic('field-ops-photos', pdfBlob, fileName);
      
      // 3. Update database
      await turso.execute({
        sql: 'UPDATE checklists SET report_url = ? WHERE id = ?',
        args: [newReportUrl, audit.id]
      });

      // 4. Send WhatsApp notification to outlet
      let waStatus = '';
      try {
        const outletRes = await turso.execute({
          sql: 'SELECT * FROM outlets WHERE name = ?',
          args: [audit.location]
        });
        const targetOutlet = outletRes.rows[0] as any;

        if (targetOutlet && targetOutlet.whatsapp_number) {
          let waNumbers: string[] = [];
          if (typeof targetOutlet.whatsapp_number === 'string') {
            try {
              waNumbers = JSON.parse(targetOutlet.whatsapp_number);
            } catch {
              waNumbers = [targetOutlet.whatsapp_number];
            }
          } else if (Array.isArray(targetOutlet.whatsapp_number)) {
            waNumbers = targetOutlet.whatsapp_number;
          }

          if (waNumbers.length > 0) {
            const settingsRes = await turso.execute({
              sql: 'SELECT value FROM settings WHERE key = ?',
              args: ['fonnte_token']
            });
            const dbToken = settingsRes.rows.length > 0 ? settingsRes.rows[0].value as string : undefined;

            const waMessage = `🔄 *Laporan Audit Diperbarui* 🔄\n\n*Outlet:* ${targetOutlet.name}\n*Waktu Regenerasi:* ${new Date().toLocaleString('id-ID')}\n\nLaporan terbaru telah dibuat. Silakan unduh pada tautan berikut.`;

            await sendWhatsAppMessage({
              targets: waNumbers,
              message: waMessage,
              fileUrl: newReportUrl,
              filename: `${auditorName}_${locationName}_${dateStr}.pdf`,
              token: dbToken
            });
            waStatus = '\n(Notifikasi WhatsApp terkirim)';
          } else {
            waStatus = `\n(Peringatan: Outlet '${audit.location}' tidak memiliki nomor WhatsApp.)`;
          }
        } else {
          waStatus = `\n(Peringatan: Outlet '${audit.location}' tidak ditemukan.)`;
        }
      } catch (waError: any) {
        console.error("Failed to send WhatsApp notification:", waError);
        waStatus = `\n(Peringatan: Gagal mengirim notifikasi WhatsApp: ${waError.message || 'Unknown error'})`;
      }

      alert(`Report regenerated successfully!${waStatus}`);
      window.location.reload(); 
    } catch (error: any) {
      console.error('Failed to regenerate report:', error);
      alert(`Failed to regenerate report: ${error.message}`);
    } finally {
      setIsRegenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral">Generated Reports</h2>
      <p className="text-gray-600">
        Here is a list of all completed audits with their automatically generated PDF reports.
      </p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-base-200">
              <tr>
                <th className="p-3 font-semibold">Audit Title</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Auditor</th>
                <th className="p-3 font-semibold">Score</th>
                <th className="p-3 font-semibold">Completion Date</th>
                <th className="p-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedAudits.length > 0 ? (
                completedAudits.map(audit => {
                  const auditor = audit.assigned_to ? userMap.get(audit.assigned_to) : null;
                  return (
                    <tr key={audit.id} className="border-b hover:bg-base-200/50">
                      <td className="p-3">
                        <div className="flex items-center">
                          <FileText className="w-5 h-5 mr-3 text-primary" />
                          <span className="font-medium text-neutral">{audit.title}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">{audit.location}</td>
                      <td className="p-3">
                        {auditor ? (
                          <div className="flex items-center">
                            <Avatar user={auditor} className="w-8 h-8 mr-2" />
                            <span>{auditor.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {audit.scoring_enabled ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">{audit.score_percentage}%</span>
                            <span className="text-[10px] text-gray-500">{audit.total_score} / {audit.max_score}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700">
                        {audit.check_out_time ? new Date(audit.check_out_time).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          <Button
                            variant="primary"
                            className="!py-1 !px-3 !text-sm"
                            onClick={() => handleDownloadReport(audit)}
                            disabled={downloadingId === audit.id || isRegenerating === audit.id}
                          >
                            <Download size={16} className="mr-2" />
                            {downloadingId === audit.id ? 'Downloading...' : 'Download PDF'}
                          </Button>
                          
                          <Button
                            variant="secondary"
                            className="!py-1 !px-3 !text-sm"
                            onClick={() => handleRegenerateReport(audit)}
                            disabled={downloadingId === audit.id || isRegenerating === audit.id}
                          >
                            <RefreshCw size={16} className={`mr-2 ${isRegenerating === audit.id ? 'animate-spin' : ''}`} />
                            {isRegenerating === audit.id ? 'Regenerating...' : 'Regenerate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-gray-500">
                    <h3 className="text-lg font-semibold">No Reports Found</h3>
                    <p>Completed audits with generated reports will appear here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ReportsView;
