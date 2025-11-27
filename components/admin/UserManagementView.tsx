import React, { useState, useCallback } from 'react';
import { User, Role } from '../../types';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Avatar from '../shared/Avatar';

interface UserManagementViewProps {
  users: User[];
  onAddUser: (user: Omit<User, 'id' | 'avatar_url'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const UserForm: React.FC<{ user?: User | null; onSave: (user: any) => void; onCancel: () => void }> = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || Role.Auditor,
    location: user?.location || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      onSave({ ...user, ...formData });
    } else {
      onSave(formData);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
        <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
        <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
          {Object.values(Role).map(role => <option key={role} value={role}>{role}</option>)}
        </select>
      </div>
       <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
        <input type="text" name="location" id="location" value={formData.location} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
       <div className="flex justify-end pt-4 space-x-2">
         <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
         <Button type="submit" variant="primary">Save User</Button>
       </div>
    </form>
  )
}


const UserManagementView: React.FC<UserManagementViewProps> = ({ users, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleOpenModal = useCallback((user?: User) => {
    setEditingUser(user || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingUser(null);
  }, []);

  const handleSave = (user: User | Omit<User, 'id' | 'avatar_url'>) => {
    if ('id' in user) {
      onUpdateUser(user);
    } else {
      onAddUser(user);
    }
    handleCloseModal();
  };

  const handleDelete = (userId: string) => {
    // All validation and confirmation logic is handled by the parent component via the `onDeleteUser` prop.
    onDeleteUser(userId);
  };

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral">User Management</h2>
          <Button onClick={() => handleOpenModal()}><Plus size={16} className="mr-2" /> Add New User</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-base-200">
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Location</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b hover:bg-base-200">
                  <td className="p-3">
                    <div className="flex items-center">
                      <Avatar user={user} className="w-10 h-10 mr-3" />
                      <div>
                        <div className="font-bold">{user.name || 'Unnamed User'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">{user.location}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                        <button onClick={() => handleOpenModal(user)} className="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-blue-100"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(user.id)} className="p-2 text-gray-500 hover:text-error rounded-full hover:bg-red-100"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Add New User'}
      >
        <UserForm user={editingUser} onSave={handleSave} onCancel={handleCloseModal} />
      </Modal>
    </>
  );
};

export default UserManagementView;
