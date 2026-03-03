import React, { useMemo } from 'react';
import { Checklist, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import Button from '../shared/Button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface MissedReportsViewProps {
  checklists: Checklist[];
  users: User[];
  onBack: () => void;
}

const MissedReportsView: React.FC<MissedReportsViewProps> = ({ checklists, users, onBack }) => {
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const missedReports = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return checklists
      .filter(c => c.status !== 'completed' && c.due_date && c.due_date < today)
      .sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime());
  }, [checklists]);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft size={24} />
        </Button>
        <div>
            <h2 className="text-2xl font-bold text-neutral">Missed Reports</h2>
            <p className="text-gray-600">
                Checklists that were not completed by their due date.
            </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-base-200">
              <tr>
                <th className="p-3 font-semibold">Audit Title</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Assigned Auditor</th>
                <th className="p-3 font-semibold">Due Date</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {missedReports.length > 0 ? (
                missedReports.map(checklist => {
                  const auditor = checklist.assigned_to ? userMap.get(checklist.assigned_to) : null;
                  return (
                    <tr key={checklist.id} className="border-b hover:bg-base-200/50">
                      <td className="p-3">
                        <div className="flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-3 text-error" />
                          <span className="font-medium text-neutral">{checklist.title}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">{checklist.location}</td>
                      <td className="p-3">
                        {auditor ? (
                          <div className="flex items-center">
                            <Avatar user={auditor} className="w-8 h-8 mr-2" />
                            <span>{auditor.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-error font-semibold">
                        {checklist.due_date}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                            checklist.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                            {checklist.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                        <AlertTriangle className="w-12 h-12 text-gray-300 mb-2" />
                        <p>No missed reports found.</p>
                    </div>
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

export default MissedReportsView;
