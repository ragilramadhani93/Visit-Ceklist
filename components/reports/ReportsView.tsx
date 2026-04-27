import React, { useMemo, useState } from 'react';
import { Checklist, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import Button from '../shared/Button';
import { Download, FileText } from 'lucide-react';

// Get API base URL from environment
const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';

const ReportsView: React.FC<ReportsViewProps> = ({ checklists, users }) => {
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      const response = await fetch(`${apiBaseUrl}/api/report-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportPath: audit.report_url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download link');
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
                        <Button
                          variant="primary"
                          className="!py-1 !px-3 !text-sm"
                          onClick={() => handleDownloadReport(audit)}
                          disabled={downloadingId === audit.id}
                        >
                          <Download size={16} className="mr-2" />
                          {downloadingId === audit.id ? 'Downloading...' : 'Download PDF'}
                        </Button>
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
