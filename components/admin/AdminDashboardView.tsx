import React from 'react';
import { Users, MapPin, FileText as FileTextIcon, HeartPulse, Store, ClipboardPlus } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { View } from '../../types';

interface AdminDashboardViewProps {
  setView: (view: View) => void;
  usersCount: number;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <Card className="flex items-center p-4">
      <div className={`p-3 rounded-full mr-4 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-neutral">{value}</p>
      </div>
    </Card>
);

const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ setView, usersCount }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral">Admin Dashboard</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={String(usersCount)} icon={<Users className="text-white" />} color="bg-blue-500" />
        <StatCard title="Managed Outlets" value="14" icon={<Store className="text-white" />} color="bg-teal-500" />
        <StatCard title="Checklist Templates" value="48" icon={<FileTextIcon className="text-white" />} color="bg-orange-500" />
        <StatCard title="System Health" value="Optimal" icon={<HeartPulse className="text-white" />} color="bg-success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
         <Card>
          <h3 className="text-lg font-bold text-neutral mb-4">Create Assignments</h3>
          <p className="text-gray-600">Assign new audit checklists to your auditors for specific outlets.</p>
          <Button onClick={() => setView('assignments')} className="mt-4"><ClipboardPlus className="mr-2" /> New Assignment</Button>
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-neutral mb-4">User Management</h3>
          <p className="text-gray-600">Add, remove, or edit user profiles and permissions. Assign roles to team members.</p>
          <Button onClick={() => setView('user_management')} className="mt-4">Manage Users</Button>
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-neutral mb-4">Outlet Management</h3>
          <p className="text-gray-600">Define and manage business locations, assign managers, and view outlet-specific data.</p>
          <Button onClick={() => setView('outlet_management')} className="mt-4">Manage Outlets</Button>
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-neutral mb-4">Template Editor</h3>
          <p className="text-gray-600">Create and customize checklist templates for different types of audits and inspections.</p>
          <Button onClick={() => setView('templates')} className="mt-4">Create Template</Button>
        </Card>
        <Card className="md:col-span-2 lg:col-span-2">
          <h3 className="text-lg font-bold text-neutral mb-4">Global Settings</h3>
          <p className="text-gray-600">Configure application-wide settings, manage integrations, and set reporting preferences.</p>
          <Button onClick={() => alert('Placeholder for Global Settings')} variant="secondary" className="mt-4">System Settings</Button>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardView;
