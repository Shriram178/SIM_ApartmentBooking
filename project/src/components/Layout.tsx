import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User as UserIcon, ToggleLeft, ToggleRight } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
  userMode?: boolean;
  onToggleMode?: () => void;
}

export function Layout({ children, showNavigation = true, userMode = true, onToggleMode }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {showNavigation && (
        <header className="bg-white shadow-sm border-b px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              Request Accommodation
            </h1>
            
            <div className="flex items-center space-x-4">
              {user?.accessLevel === 'admin' && onToggleMode && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">User</span>
                  <button
                    onClick={onToggleMode}
                    className="flex items-center p-1 rounded-md hover:bg-gray-100 transition-colors"
                    title={userMode ? 'Switch to Admin Mode' : 'Switch to User Mode'}
                  >
                    {userMode ? (
                      <ToggleLeft size={24} className="text-blue-600" />
                    ) : (
                      <ToggleRight size={24} className="text-blue-600" />
                    )}
                  </button>
                  <span className="text-sm text-gray-600">Admin</span>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon size={16} className="text-blue-600" />
                </div>
                
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.name}</div>
                  <div className="text-gray-500">{user?.role}</div>
                </div>
                
                <button
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>
      )}
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}