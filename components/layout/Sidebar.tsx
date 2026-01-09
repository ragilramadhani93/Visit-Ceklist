

import React from 'react';
import { LayoutDashboard, CheckSquare, ClipboardList, BarChart3, Settings, LogOut, X, Users, FileText, Store, ClipboardPlus } from 'lucide-react';
import { View, User, Role } from '../../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: User;
  onLogout: () => void;
}

// IMPORTANT: See README for instructions on updating this URL.
const LOGO_URL = "https://xkzmddgcwcqvhicdqrpa.supabase.co/storage/v1/object/public/field-ops-photos/viLjdYG8hKmB34Y0CZFvFTm8BWcavvRr5B05IUl1%20(1).jpg";

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => {
  return (
    <li
      onClick={onClick}
      className={`
        flex items-center p-3 my-1 rounded-lg cursor-pointer transition-colors duration-200
        ${isActive ? 'bg-primary text-white shadow-lg' : 'text-gray-600 hover:bg-base-300 hover:text-neutral'}
      `}
    >
      {icon}
      <span className="ml-4 font-medium">{label}</span>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, setIsOpen, user, onLogout }) => {
    
    const getNavItems = (role: Role) => {
        const allItems = [
            { id: 'admin_dashboard' as View, label: 'Admin Dashboard', icon: <LayoutDashboard size={20} />, roles: [Role.Admin] },
            { id: 'auditor_dashboard' as View, label: 'My Dashboard', icon: <LayoutDashboard size={20} />, roles: [Role.Auditor] },
            { id: 'assignments' as View, label: 'Assignments', icon: <ClipboardPlus size={20} />, roles: [Role.Admin] },
            { id: 'findings' as View, label: 'Findings', icon: <ClipboardList size={20} />, roles: [Role.Admin, Role.Auditor] },
            { id: 'reports' as View, label: 'Reports', icon: <BarChart3 size={20} />, roles: [Role.Admin, Role.Auditor] },
            { id: 'user_management' as View, label: 'User Management', icon: <Users size={20} />, roles: [Role.Admin] },
            { id: 'outlet_management' as View, label: 'Outlet Management', icon: <Store size={20} />, roles: [Role.Admin] },
            { id: 'templates' as View, label: 'Templates', icon: <FileText size={20} />, roles: [Role.Admin] },
        ];
        return allItems.filter(item => item.roles.includes(role));
    }

    const navItems = getNavItems(user.role);
    
    const handleSetView = (view: View) => {
        setView(view);
        setIsOpen(false);
    }
  
    return (
        <>
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}></div>
        <aside className={`absolute lg:relative flex flex-col w-64 bg-base-100 shadow-lg h-full z-30 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
            <div className="flex items-center justify-between p-4 border-b border-base-300">
                <img src={LOGO_URL} alt="Kapal Api Logo" className="h-12 w-auto" />
                 <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-500">
                    <X size={24} />
                </button>
            </div>
            <nav className="flex-1 px-4 py-4">
                <ul>
                    {navItems.map(item => (
                        <NavItem
                            key={item.id}
                            icon={item.icon}
                            label={item.label}
                            isActive={currentView === item.id}
                            onClick={() => handleSetView(item.id)}
                        />
                    ))}
                </ul>
            </nav>
            <div className="px-4 py-4 border-t border-base-300">
                <ul>
                    <NavItem icon={<Settings size={20} />} label="Settings" isActive={false} onClick={() => alert('Placeholder for Settings')} />
                    <NavItem icon={<LogOut size={20} />} label="Logout" isActive={false} onClick={onLogout} />
                </ul>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
