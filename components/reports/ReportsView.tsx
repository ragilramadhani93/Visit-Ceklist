import React, { useMemo } from 'react';
import { Checklist, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import Button from '../shared/Button';
import { Download, FileText } from 'lucide-react';

interface ReportsViewProps {
  checklists: Checklist[];
  users: User[];
}

const ReportsView: React.FC<ReportsViewProps> = ({ checklists, users }) => {
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const completedAudits = useMemo(() => {
    return checklists
      .filter(c => c.status === 'completed' && c.report_url)
      .sort((a, b) => new Date(b.check_out_time!).getTime() - new Date(a.check_out_time!).getTime());
  }, [checklists]);

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
                      <td className="p-3 text-gray-700">
                        {audit.check_out_time ? new Date(audit.check_out_time).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3 text-center">
                        <a
                          href={audit.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <Button variant="primary" className="!py-1 !px-3 !text-sm">
                            <Download size={16} className="mr-2" />
                            Download PDF
                          </Button>
                        </a>
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
