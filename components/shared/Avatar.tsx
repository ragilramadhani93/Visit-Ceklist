import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ user, className = 'w-10 h-10' }) => {
  const getInitials = (name: string | null): string => {
    if (!name) return '';
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    if (nameParts.length === 1 && nameParts[0].length > 0) {
      return nameParts[0][0].toUpperCase();
    }
    return '';
  };

  const generateColor = (id: string): string => {
    let hash = 0;
    if (!id || id.length === 0) return 'bg-gray-500';
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    const colors = [
        'bg-primary', 'bg-secondary', 'bg-accent',
        'bg-red-500', 'bg-orange-500', 'bg-yellow-600', 'bg-green-500', 
        'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500'
    ];
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name || 'User Avatar'} className={`rounded-full object-cover ${className}`} />;
  }

  const initials = getInitials(user.name);
  const bgColor = generateColor(user.id);

  if (initials) {
    return (
      <div className={`rounded-full flex items-center justify-center text-white font-bold text-sm ${bgColor} ${className}`}>
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-full flex items-center justify-center bg-gray-300 text-gray-500 ${className}`}>
      <UserIcon className="w-1/2 h-1/2" />
    </div>
  );
};

export default Avatar;
