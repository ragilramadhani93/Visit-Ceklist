import React, { useState, useMemo } from 'react';
import { User, Outlet, ChecklistTemplate, Role, Checklist } from '../../types';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { ClipboardPlus, ArrowLeft, History, Edit, Trash2 } from 'lucide-react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';

interface AssignmentViewProps {
  users: User[];
  outlets: Outlet[];
  templates: ChecklistTemplate[];
  checklists: Checklist[];
  onCreateAssignments: (auditorId: string, outletIds: string[], templateIds: string[], dueDate: string) => void;
  onUpdateAssignment: (checklistId: string, updates: Partial<Checklist>) => Promise<void> | void;
  onCancelAssignment: (checklistId: string) => Promise<void> | void;
  onCancel: () => void;
}

const AssignmentView: React.FC<AssignmentViewProps> = ({ users, outlets, templates, checklists, onCreateAssignments, onUpdateAssignment, onCancelAssignment, onCancel }) => {
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>('');
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editAuditorId, setEditAuditorId] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  
  const auditors = useMemo(() => users.filter(u => u.role === Role.Auditor), [users]);
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const sortedChecklists = useMemo(() => {
    return [...checklists].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
    });
  }, [checklists]);

  const openEditModal = (cl: Checklist) => {
    setEditingChecklist(cl);
    setEditAuditorId(cl.assigned_to || '');
    setEditDueDate(cl.due_date || '');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingChecklist(null);
    setEditAuditorId('');
    setEditDueDate('');
  };

  const handleSaveEdit = async () => {
    if (!editingChecklist) return;
    const updates: Partial<Checklist> = {
      assigned_to: editAuditorId || null,
      due_date: editDueDate || null,
    };
    await onUpdateAssignment(editingChecklist.id, updates);
    closeEditModal();
  };

  const handleOutletToggle = (outletId: string) => {
    setSelectedOutletIds(prev =>
      prev.includes(outletId) ? prev.filter(id => id !== outletId) : [...prev, outletId]
    );
  };
  
  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplateIds(prev =>
      prev.includes(templateId) ? prev.filter(id => id !== templateId) : [...prev, templateId]
    );
  };
  
  const handleSelectAllOutlets = () => {
      if (selectedOutletIds.length === outlets.length) {
          setSelectedOutletIds([]);
      } else {
          setSelectedOutletIds(outlets.map(o => o.id));
      }
  }

  const handleSelectAllTemplates = () => {
      if (selectedTemplateIds.length === templates.length) {
          setSelectedTemplateIds([]);
      } else {
          setSelectedTemplateIds(templates.map(t => t.id));
      }
  }

  const handleSubmit = () => {
    if (!selectedAuditorId || selectedOutletIds.length === 0 || selectedTemplateIds.length === 0 || !dueDate) {
      alert('Silakan pilih auditor, setidaknya satu outlet, setidaknya satu templat, dan tanggal jatuh tempo.');
      return;
    }
    onCreateAssignments(selectedAuditorId, selectedOutletIds, selectedTemplateIds, dueDate);
  };

  const assignmentsToCreate = selectedOutletIds.length * selectedTemplateIds.length;
  
  const getStatusBadge = (status: Checklist['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-200 text-yellow-800">Pending</span>;
      case 'in-progress':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-200 text-blue-800">In Progress</span>;
      case 'completed':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800">Completed</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center space-x-4">
            <button onClick={onCancel} className="p-2 hover:bg-base-300 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-neutral">Create & View Assignments</h2>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
            <Card>
                <h3 className="text-lg font-bold text-neutral mb-4">1. Select Auditor & Due Date</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="auditor" className="block text-sm font-medium text-gray-700">Assign To</label>
                        <select
                        id="auditor"
                        value={selectedAuditorId}
                        onChange={(e) => setSelectedAuditorId(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        >
                        <option value="">-- Select an Auditor --</option>
                        {auditors.map(auditor => (
                            <option key={auditor.id} value={auditor.id}>{auditor.name}</option>
                        ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="due-date" className="block text-sm font-medium text-gray-700">Due Date</label>
                        <input
                        type="date"
                        id="due-date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>
            </Card>
        </div>

        <Card className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-neutral">2. Select Outlets</h3>
                 <Button onClick={handleSelectAllOutlets} variant="secondary" className="!text-xs !px-2 !py-1">
                    {selectedOutletIds.length === outlets.length ? 'Deselect All' : 'Select All'}
                </Button>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-60 pr-2">
            {outlets.map(outlet => (
                <label key={outlet.id} className="flex items-center p-2 rounded-md hover:bg-base-200 cursor-pointer">
                <input
                    type="checkbox"
                    checked={selectedOutletIds.includes(outlet.id)}
                    onChange={() => handleOutletToggle(outlet.id)}
                    className="h-4 w-4 text-primary focus:ring-primary-focus border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{outlet.name}</span>
                </label>
            ))}
            </div>
        </Card>
        
        <Card className="lg:col-span-2 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-neutral">3. Select Checklist Templates</h3>
                <Button onClick={handleSelectAllTemplates} variant="secondary" className="!text-xs !px-2 !py-1">
                    {selectedTemplateIds.length === templates.length ? 'Deselect All' : 'Select All'}
                </Button>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-60 pr-2">
            {templates.map(template => (
                <label key={template.id} className="flex items-center p-2 rounded-md hover:bg-base-200 cursor-pointer">
                <input
                    type="checkbox"
                    checked={selectedTemplateIds.includes(template.id)}
                    onChange={() => handleTemplateToggle(template.id)}
                    className="h-4 w-4 text-primary focus:ring-primary-focus border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{template.title}</span>
                </label>
            ))}
            </div>
        </Card>
      </div>

        <Card className="mt-6 bg-primary/10 border border-primary/20">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-3">
                <div>
                    <h4 className="font-bold text-lg text-neutral">Assignment Summary</h4>
                    <p className="text-gray-600">
                        You are about to create <strong className="text-primary">{assignmentsToCreate}</strong> new checklist(s).
                        ({selectedOutletIds.length} outlets &times; {selectedTemplateIds.length} templates)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="secondary"
                        onClick={onCancel}
                        className="w-full md:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={assignmentsToCreate === 0 || !selectedAuditorId || !dueDate}
                        className="w-full md:w-auto"
                    >
                        <ClipboardPlus className="mr-2" />
                        Create {assignmentsToCreate > 0 ? assignmentsToCreate : ''} Assignments
                    </Button>
                </div>
            </div>
        </Card>

        <Card className="mt-6">
            <h3 className="text-lg font-bold text-neutral mb-4 flex items-center"><History size={20} className="mr-2 text-primary"/>Assignment History</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-base-200">
                        <tr>
                            <th className="p-3 font-semibold">Title</th>
                            <th className="p-3 font-semibold">Location</th>
                            <th className="p-3 font-semibold">Assigned To</th>
                            <th className="p-3 font-semibold">Due Date</th>
                            <th className="p-3 font-semibold">Status</th>
                            <th className="p-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedChecklists.length > 0 ? sortedChecklists.map(checklist => {
                            const auditor = checklist.assigned_to ? userMap.get(checklist.assigned_to) : null;
                            const isOverdue = checklist.status !== 'completed' && checklist.due_date && checklist.due_date < new Date().toISOString().split('T')[0];
                            return (
                                <tr key={checklist.id} className="border-b hover:bg-base-200/50">
                                    <td className="p-3 font-medium text-neutral">{checklist.title}</td>
                                    <td className="p-3">{checklist.location}</td>
                                    <td className="p-3">
                                        {auditor ? (
                                            <div className="flex items-center">
                                                <Avatar user={auditor} className="w-7 h-7 mr-2" />
                                                <span className="text-xs">{auditor.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {checklist.due_date}
                                        {isOverdue && <span className="ml-2 text-error font-bold text-xs">(Overdue)</span>}
                                    </td>
                                    <td className="p-3">{getStatusBadge(checklist.status)}</td>
                                    <td className="p-3 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => openEditModal(checklist)} className="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-blue-100" title="Edit">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => {
                                                if (window.confirm('Yakin ingin membatalkan assignment ini?')) onCancelAssignment(checklist.id);
                                            }} className="p-2 text-gray-500 hover:text-error rounded-full hover:bg-red-100" title="Cancel">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={5} className="text-center p-6 text-gray-500">
                                    No assignments have been created yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
        <Modal 
          isOpen={isEditOpen} 
          onClose={closeEditModal} 
          title="Edit Assignment"
          footer={(
            <>
              <Button variant="secondary" onClick={closeEditModal}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </>
          )}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Assigned To</label>
              <select 
                value={editAuditorId} 
                onChange={(e) => setEditAuditorId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              >
                <option value="">-- Unassigned --</option>
                {auditors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input 
                type="date" 
                value={editDueDate} 
                onChange={(e) => setEditDueDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </Modal>
    </div>
  );
};

export default AssignmentView;
