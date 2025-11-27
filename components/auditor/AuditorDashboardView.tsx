import React, { useState, useMemo } from 'react';
import Card from '../shared/Card';
import { Checklist, Task, User, TaskPriority } from '../../types';
import ResolveFindingModal from '../findings/ResolveFindingModal';
import ImageModal from '../shared/ImageModal';
import { Wrench, Flag, CheckSquare, MessageSquare } from 'lucide-react';
import Button from '../shared/Button';

interface EnrichedFinding extends Task {
  location?: string | null;
  checklistTitle?: string;
  sourceQuestion?: string;
  assignee?: User | null;
}

interface AuditorDashboardViewProps {
    user: User;
    onSelectChecklist: (checklist: Checklist) => void;
    checklists: Checklist[];
    tasks: Task[];
    users: User[];
    onResolveTask: (taskId: string, resolutionData: { photo: string }) => Promise<void>;
}

const AuditorDashboardView: React.FC<AuditorDashboardViewProps> = ({ user, onSelectChecklist, checklists, tasks, users, onResolveTask }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFinding, setSelectedFinding] = useState<EnrichedFinding | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const enrichedMyTasks = useMemo<EnrichedFinding[]>(() => {
        const myOpenTasks = tasks.filter(t => (t.status === 'open' || t.status === 'in-progress') && t.assigned_to === user.id);
        const checklistMap = new Map<string, Checklist>(checklists.map(c => [c.id, c]));
        const userMap = new Map<string, User>(users.map(u => [u.id, u]));

        return myOpenTasks.map(task => {
            const checklist = task.checklist_id ? checklistMap.get(task.checklist_id) : undefined;
            const sourceItem = checklist?.items.find(item => item.id === task.checklist_item_id);
            return {
                ...task,
                location: checklist?.location,
                checklistTitle: checklist?.title,
                sourceQuestion: sourceItem?.question,
                assignee: task.assigned_to ? userMap.get(task.assigned_to) : null,
            };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [tasks, checklists, users, user.id]);

    const handleOpenResolveModal = (finding: EnrichedFinding) => {
        setSelectedFinding(finding);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedFinding(null);
    };

    const handleResolveSubmit = async (taskId: string, resolutionData: { photo: string }) => {
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


    return (
        <>
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-neutral">Welcome, {user.name?.split(' ')[0] || 'Auditor'}!</h2>
            <p className="text-gray-600">Here are your assigned checklists and open tasks.</p>

            <Card>
                <h3 className="font-bold mb-4 text-neutral">My Assigned Checklists</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b">
                                <th className="p-2">Title</th>
                                <th className="p-2">Location</th>
                                <th className="p-2">Due Date</th>
                                <th className="p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checklists.filter(c => c.status !== 'completed' && c.assigned_to === user.id).length > 0 ? checklists.filter(c => c.status !== 'completed' && c.assigned_to === user.id).map(checklist => (
                                <tr key={checklist.id} className="border-b hover:bg-base-200 cursor-pointer" onClick={() => onSelectChecklist(checklist)}>
                                    <td className="p-2 font-medium">{checklist.title}</td>
                                    <td className="p-2">{checklist.location}</td>
                                    <td className="p-2">{checklist.due_date}</td>
                                    <td className="p-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            checklist.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800'
                                        }`}>
                                            {checklist.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-500">No pending checklists assigned.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card>
                <h3 className="font-bold mb-4 text-neutral">My Open Findings</h3>
                <div className="space-y-4">
                    {enrichedMyTasks.length > 0 ? enrichedMyTasks.map(task => {
                        const priorityStyles = getPriorityStyles(task.priority);
                        const statusStyles = getStatusStyles(task.status);
                        const hasEvidence = !!task.photo;
                        return (
                            <Card key={task.id} className={`border-l-4 ${priorityStyles.border} transition-shadow hover:shadow-lg p-4`}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-md text-neutral pr-4">{task.title}</h4>
                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center ${priorityStyles.bg} ${priorityStyles.text}`}>
                                                <Flag size={12} className="mr-1"/> {task.priority || 'N/A'}
                                            </span>
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center ${statusStyles.bg} ${statusStyles.text}`}>
                                                <CheckSquare size={12} className="mr-1"/> {task.status || 'N/A'}
                                            </span>
                                            </div>
                                        </div>
                                        {task.description && (
                                            <div className="text-sm text-gray-800 bg-base-200/60 p-2 rounded-md mt-2 grid grid-cols-[auto_1fr] gap-x-2 items-start">
                                                <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-gray-400"/>
                                                <p className="min-w-0 whitespace-pre-wrap break-words">{task.description}</p>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t items-center">
                                            <span className="text-sm font-medium text-error">Due: {task.due_date}</span>
                                            <div className="flex-grow flex items-end justify-end">
                                                <Button onClick={() => handleOpenResolveModal(task)} variant='primary' className="!text-sm !py-1.5">
                                                    <Wrench size={16} className="mr-2"/>
                                                    Resolve Finding
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-1">
                                    {!hasEvidence ? (
                                        <div className="flex items-center justify-center h-full bg-base-200/50 rounded-lg border-2 border-dashed">
                                            <p className="text-sm text-gray-400">No Photo</p>
                                        </div>
                                        ) : (
                                        <div className="flex flex-col">
                                            <button onClick={() => handleOpenImageModal(task.photo!)} className="w-full h-full focus:outline-none focus:ring-2 focus:ring-primary rounded-lg group">
                                                <img src={task.photo} alt="Finding evidence" className="rounded-lg object-cover w-full h-28 md:h-full cursor-pointer transition-transform group-hover:scale-105" />
                                            </button>
                                        </div>
                                    )}
                                    </div>
                                </div>
                            </Card>
                        )
                    }) : <p className="text-gray-500 p-4 text-center">No open tasks. Great job!</p>}
                </div>
            </Card>
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

export default AuditorDashboardView;
