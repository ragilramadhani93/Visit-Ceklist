import React, { useState, useCallback } from 'react';
import { Outlet, User } from '../../types';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Plus, Edit, Trash2, Store } from 'lucide-react';
import Avatar from '../shared/Avatar';

interface OutletManagementViewProps {
  outlets: Outlet[];
  users: User[];
  onAddOutlet: (outlet: Omit<Outlet, 'id'>) => void;
  onUpdateOutlet: (outlet: Outlet) => void;
  onDeleteOutlet: (outletId: string) => void;
}

const OutletForm: React.FC<{ outlet?: Outlet | null; users: User[]; onSave: (outlet: any) => void; onCancel: () => void }> = ({ outlet, users, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: outlet?.name || '',
    address: outlet?.address || '',
    manager_id: outlet?.manager_id || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, manager_id: formData.manager_id || null };
    if (outlet) {
      onSave({ ...outlet, ...dataToSave });
    } else {
      onSave(dataToSave);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Outlet Name</label>
        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
        <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="manager_id" className="block text-sm font-medium text-gray-700">Assigned Manager</label>
        <select name="manager_id" id="manager_id" value={formData.manager_id} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
          <option value="">-- No Manager --</option>
          {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </div>
       <div className="flex justify-end pt-4 space-x-2">
         <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
         <Button type="submit" variant="primary">Save Outlet</Button>
       </div>
    </form>
  )
}


const OutletManagementView: React.FC<OutletManagementViewProps> = ({ outlets, users, onAddOutlet, onUpdateOutlet, onDeleteOutlet }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);

  // FIX: Explicitly type the Map to ensure TypeScript correctly infers the type of `userMap.get()`, resolving an 'unknown' type error.
  const userMap = new Map<string, User>(users.map(user => [user.id, user]));

  const handleOpenModal = useCallback((outlet?: Outlet) => {
    setEditingOutlet(outlet || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingOutlet(null);
  }, []);

  const handleSave = (outlet: Outlet | Omit<Outlet, 'id'>) => {
    if ('id' in outlet) {
      onUpdateOutlet(outlet);
    } else {
      onAddOutlet(outlet);
    }
    handleCloseModal();
  };

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral">Outlet Management</h2>
          <Button onClick={() => handleOpenModal()}><Plus size={16} className="mr-2" /> Add New Outlet</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-base-200">
                <th className="p-3 whitespace-nowrap">Outlet Name</th>
                <th className="p-3 whitespace-nowrap">Address</th>
                <th className="p-3 whitespace-nowrap">Manager</th>
                <th className="p-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map(outlet => {
                const manager = outlet.manager_id ? userMap.get(outlet.manager_id) : null;
                return (
                    <tr key={outlet.id} className="border-b hover:bg-base-200">
                    <td className="p-3 font-semibold whitespace-nowrap">
                        <div className="flex items-center">
                            <Store className="w-5 h-5 mr-3 text-primary"/>
                            {outlet.name}
                        </div>
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">{outlet.address}</td>
                    <td className="p-3 whitespace-nowrap">
                        {manager ? (
                            <div className="flex items-center">
                                <Avatar user={manager} className="w-8 h-8 mr-2" />
                                <div>
                                    <div className="font-medium text-sm">{manager.name}</div>
                                </div>
                            </div>
                        ) : (
                            <span className="text-gray-400 italic text-sm">Unassigned</span>
                        )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => handleOpenModal(outlet)} className="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-blue-100"><Edit size={18} /></button>
                            <button onClick={() => onDeleteOutlet(outlet.id)} className="p-2 text-gray-500 hover:text-error rounded-full hover:bg-red-100"><Trash2 size={18} /></button>
                        </div>
                    </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}
      >
        <OutletForm outlet={editingOutlet} users={users} onSave={handleSave} onCancel={handleCloseModal} />
      </Modal>
    </>
  );
};

export default OutletManagementView;