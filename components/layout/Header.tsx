
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../../types';
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react';
import Avatar from '../shared/Avatar';

interface HeaderProps {
  user: User;
  onMenuClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuClick, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setDropdownOpen(false);
        }
    };

    if (dropdownOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // FIX: Created a dedicated handler function for the logout button click.
  // This makes the event handling more explicit and reliable, ensuring the `onLogout`
  // prop is called correctly before the dropdown is closed.
  const handleLogoutClick = () => {
    onLogout();
    setDropdownOpen(false);
  };


  return (
    <header className="bg-base-100 shadow-sm p-4 flex justify-between items-center z-10">
      <div className="flex items-center">
         <button onClick={onMenuClick} className="lg:hidden text-gray-500 mr-4">
            <Menu size={24} />
         </button>
         <h1 className="text-xl font-bold text-neutral">Field Ops Pro</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-primary">
          <Bell size={24} />
        </button>
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <Avatar user={user} className="w-10 h-10" />
            <div>
              <p className="font-semibold text-sm">{user.name || 'Unnamed User'}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </div>
          {dropdownOpen && (
            <div 
              className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border"
            >
               <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
