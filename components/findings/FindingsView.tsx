import React, { useMemo, useState } from 'react';
import { Task, Checklist, User, TaskPriority, Role } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import { Flag, MapPin, Calendar, HelpCircle, FileText, CheckSquare, Wrench, MessageSquare, Download } from 'lucide-react';
import { generateFindingsReportPDF } from '../../services/pdfService';
import Button from '../shared/Button';
import ResolveFindingModal from './ResolveFindingModal';
import ImageModal from '../shared/ImageModal';

interface EnrichedFinding extends Task {
  location?: string | null;
  checklistTitle?: string;
  sourceQuestion?: string;
  auditor?: User | null;
  assignee?: User | null;
}

interface FindingsViewProps {
  tasks: Task[];
  checklists: Checklist[];
  users: User[];
  onResolveTask: (taskId: string, resolutionData: { photo: string; comment?: string }) => Promise<void>;
  onAssignTask: (taskId: string, assigneeId: string | null) => Promise<void>;
}

const getPriorityStyles = (priority: TaskPriority | null) => {
  if (!priority) return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' };
  switch (priority) {
    case TaskPriority.High: return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
    case TaskPriority.Medium: return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
    case TaskPriority.Low: return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' };
  }
};

const getStatusStyles = (status: Task['status']) => {
  if (!status) return { bg: 'bg-gray-200', text: 'text-gray-800' };
  switch (status) {
    case 'open': return { bg: 'bg-red-200', text: 'text-red-900' };
    case 'in-progress': return { bg: 'bg-yellow-200', text: 'text-yellow-900' };
    case 'resolved': return { bg: 'bg-green-200', text: 'text-green-900' };
    default: return { bg: 'bg-gray-200', text: 'text-gray-800' };
  }
};

const getResolvedDate = (proofUrl?: string | null): string | null => {
  if (!proofUrl) return null;
  const match = /proofs\/(?:[^_]+)_([0-9]+)\.jpg/.exec(proofUrl);
  if (match && match[1]) {
    const ts = Number(match[1]);
    if (!Number.isNaN(ts)) {
      return new Date(ts).toISOString().split('T')[0];
    }
  }
  return null;
};
const FindingCard: React.FC<{ finding: EnrichedFinding; users: User[]; onResolveClick: (finding: EnrichedFinding) => void; onImageClick: (url: string) => void; onAssignTask: (taskId: string, assigneeId: string | null) => Promise<void>; }> = ({ finding, users, onResolveClick, onImageClick, onAssignTask }) => {
    const priorityStyles = getPriorityStyles(finding.priority);
    const statusStyles = getStatusStyles(finding.status);
    const hasEvidence = !!finding.photo;
    const hasProof = !!finding.proof_of_fix;
    const auditors = users.filter(u => u.role === Role.Auditor);
    const isVideoUrl = (url: string) => {
        if (!url) return false;
        return /^data:video\//.test(url) || /\.webm($|\?)/i.test(url) || /content-type=video/i.test(url);
    };
    const evidenceIsVideo = hasEvidence ? isVideoUrl(finding.photo!) : false;

    return (
        <Card className={`mb-4 border-l-4 ${priorityStyles.border} transition-shadow hover:shadow-lg`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-neutral pr-4">{finding.title}</h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                           <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center ${priorityStyles.bg} ${priorityStyles.text}`}>
                               <Flag size={12} className="mr-1"/> {finding.priority || 'N/A'}
                           </span>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center ${statusStyles.bg} ${statusStyles.text}`}>
                               <CheckSquare size={12} className="mr-1"/> {finding.status || 'N/A'}
                           </span>
                        </div>
                    </div>

                    {finding.sourceQuestion && (
                        <p className="text-sm text-gray-600 mt-1 flex items-start">
                            <HelpCircle size={16} className="mr-2 mt-0.5 flex-shrink-0 text-gray-400"/>
                            <span className="font-semibold">Source:</span>&nbsp;{finding.sourceQuestion}
                        </p>
                    )}
                    
                    {finding.description && (
                        <div className="text-sm text-gray-800 bg-base-200/60 p-3 rounded-md mt-3 grid grid-cols-[auto_1fr] gap-x-2 items-start">
                            <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400"/>
                            <p className="min-w-0 whitespace-pre-wrap break-words">{finding.description}</p>
                        </div>
                    )}

                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                        <p className="flex items-center"><MapPin size={14} className="mr-2 text-gray-400"/> <strong>Location:</strong>&nbsp;{finding.location || 'N/A'}</p>
                        <p className="flex items-center"><FileText size={14} className="mr-2 text-gray-400"/> <strong>Audit:</strong>&nbsp;{finding.checklistTitle || 'N/A'}</p>
                        <p className="flex items-center"><Calendar size={14} className="mr-2 text-gray-400"/> <strong>Due Date:</strong>&nbsp;{finding.due_date || 'N/A'}</p>
                        {finding.status === 'resolved' && (
                          <p className="flex items-center"><Calendar size={14} className="mr-2 text-gray-400"/> <strong>Resolved:</strong>&nbsp;{getResolvedDate(finding.proof_of_fix) || 'N/A'}</p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-base-200">
                        {finding.auditor && (
                            <div className="text-xs">
                                <span className="font-bold text-gray-500 block">FOUND BY</span>
                                <div className="flex items-center mt-1">
                                    <Avatar user={finding.auditor} className="w-6 h-6 mr-2"/>
                                    <span>{finding.auditor.name}</span>
                                </div>
                            </div>
                        )}
                        <div className="text-xs min-w-[150px]">
                            <span className="font-bold text-gray-500 block mb-1">ASSIGNED TO</span>
                            <select
                                value={finding.assigned_to || ''}
                                onChange={(e) => onAssignTask(finding.id, e.target.value || null)}
                                className="block w-full pl-2 pr-8 py-1 text-sm border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md bg-white"
                            >
                                <option value="">Unassigned</option>
                                {auditors.map(user => (
                                    <option key={user.id} value={user.id}>{user.name || user.email}</option>
                                ))}
                            </select>
                        </div>
                        {finding.status !== 'resolved' && (
                            <div className="flex-grow flex items-end justify-end">
                                <Button onClick={() => onResolveClick(finding)} variant='primary' className="!text-sm !py-1.5">
                                    <Wrench size={16} className="mr-2"/>
                                    Resolve Finding
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-1">
                    {!hasEvidence && !hasProof ? (
                        <div className="flex items-center justify-center h-full bg-base-200/50 rounded-lg border-2 border-dashed">
                            <p className="text-sm text-gray-400">No Photos Attached</p>
                        </div>
                    ) : (
                        <div className={`grid ${hasEvidence && hasProof ? 'grid-cols-2' : 'grid-cols-1'} gap-2 h-full`}>
                            {hasEvidence && (
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-500 block mb-1 text-center">EVIDENCE</span>
                                    {evidenceIsVideo ? (
                                        <video
                                            src={finding.photo!}
                                            controls
                                            playsInline
                                            muted
                                            preload="none"
                                            className="rounded-lg object-cover w-full h-36 md:h-full bg-black"
                                        />
                                    ) : (
                                        <button onClick={() => onImageClick(finding.photo!)} className="w-full h-full focus:outline-none focus:ring-2 focus:ring-primary rounded-lg group">
                                            <img src={finding.photo!} alt="Finding evidence" className="rounded-lg object-cover w-full h-36 md:h-full cursor-pointer transition-transform group-hover:scale-105" />
                                        </button>
                                    )}
                                </div>
                            )}
                            {hasProof && (
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-500 block mb-1 text-center">PROOF OF FIX</span>
                                    <button onClick={() => onImageClick(finding.proof_of_fix!)} className="w-full h-full focus:outline-none focus:ring-2 focus:ring-primary rounded-lg group">
                                        <img src={finding.proof_of_fix} alt="Proof of fix" className="rounded-lg object-cover w-full h-36 md:h-full cursor-pointer transition-transform group-hover:scale-105" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};


const FindingsView: React.FC<FindingsViewProps> = ({ tasks, checklists, users, onResolveTask, onAssignTask }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<EnrichedFinding | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const enrichedFindings = useMemo<EnrichedFinding[]>(() => {
    const checklistMap = new Map<string, Checklist>(checklists.map(c => [c.id, c]));
    const userMap = new Map<string, User>(users.map(u => [u.id, u]));

    return tasks.map(task => {
      const checklist = task.checklist_id ? checklistMap.get(task.checklist_id) : undefined;
      const sourceItem = checklist?.items.find(item => item.id === task.checklist_item_id);
      
      return {
        ...task,
        location: checklist?.location,
        checklistTitle: checklist?.title,
        sourceQuestion: sourceItem?.question,
        auditor: checklist?.assigned_to ? userMap.get(checklist.assigned_to) : null,
        assignee: task.assigned_to ? userMap.get(task.assigned_to) : null,
      };
    }).sort((a, b) => {
        const statusOrder = { 'open': 1, 'in-progress': 2, 'resolved': 3 };
        const statusA = statusOrder[a.status as keyof typeof statusOrder] || 4;
        const statusB = statusOrder[b.status as keyof typeof statusOrder] || 4;
        if (statusA !== statusB) {
            return statusA - statusB;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, checklists, users]);

  const filteredFindings = useMemo(() => {
    return enrichedFindings.filter(finding => {
      const statusMatch = statusFilter === 'all' || finding.status === statusFilter;
      const priorityMatch = priorityFilter === 'all' || finding.priority === priorityFilter;
      const locationMatch = locationFilter === 'all' || (finding.location || '') === locationFilter;
      return statusMatch && priorityMatch && locationMatch;
    });
  }, [enrichedFindings, statusFilter, priorityFilter, locationFilter]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    checklists.forEach(c => { if (c.location) set.add(c.location); });
    return Array.from(set).sort();
  }, [checklists]);

  const handleDownloadReport = async () => {
    const title = locationFilter === 'all' ? 'All Locations' : locationFilter;
    const blob = await generateFindingsReportPDF(filteredFindings, checklists, users, `Findings Report - ${title}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `findings_${title.replace(/\s+/g, '_').toLowerCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  
  const handleOpenResolveModal = (finding: EnrichedFinding) => {
    setSelectedFinding(finding);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFinding(null);
  };

  const handleResolveSubmit = async (taskId: string, resolutionData: { photo: string; comment?: string }) => {
    await onResolveTask(taskId, resolutionData);
    handleCloseModal();
  };
  
  const handleOpenImageModal = (url: string) => {
    setSelectedImageUrl(url);
    setIsImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageUrl(null);
  };

  return (
    <>
        <div className="space-y-6">
        <h2 className="text-2xl font-bold text-neutral">Audit Findings</h2>
        
        <Card>
            <div className="flex flex-wrap gap-4 items-center">
                <h3 className="text-md font-semibold mr-4">Filters:</h3>
                <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Status</label>
                    <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                        <option value="all">All</option>
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700">Priority</label>
                    <select id="priority-filter" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                        <option value="all">All</option>
                        <option value={TaskPriority.High}>High</option>
                        <option value={TaskPriority.Medium}>Medium</option>
                        <option value={TaskPriority.Low}>Low</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700">Location</label>
                    <select id="location-filter" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                        <option value="all">All</option>
                        {locations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
                <div className="ml-auto">
                    <Button onClick={handleDownloadReport} variant="primary" className="!text-sm !py-2">
                      <Download size={16} className="mr-2" />
                      Download PDF
                    </Button>
                </div>
            </div>
        </Card>

        <div>
            {filteredFindings.length > 0 ? (
                filteredFindings.map(finding => (
                    <FindingCard key={finding.id} finding={finding} users={users} onResolveClick={handleOpenResolveModal} onImageClick={handleOpenImageModal} onAssignTask={onAssignTask} />
                ))
            ) : (
                <Card className="text-center py-12">
                    <h3 className="text-lg font-semibold text-gray-700">No Findings Found</h3>
                    <p className="text-gray-500 mt-2">There are no findings that match your current filters.</p>
                </Card>
            )}
        </div>
        </div>

        {selectedFinding && (
            <ResolveFindingModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                finding={selectedFinding}
                onResolve={handleResolveSubmit}
            />
        )}
        
        <ImageModal
            isOpen={isImageModalOpen}
            onClose={handleCloseImageModal}
            imageUrl={selectedImageUrl}
        />
    </>
  );
};

export default FindingsView;
