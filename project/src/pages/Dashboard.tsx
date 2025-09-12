import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { TabNavigation } from '../components/TabNavigation';
import { GenderSelectionModal } from '../components/GenderSelectionModal';
import { ProfileModal } from '../components/ProfileModal';


// User pages
import { UserBooking } from './user/UserBooking';
import { UserPendingRequests } from './user/UserPendingRequests';
import { UserUpcomingBookings } from './user/UserUpcomingBookings';
import { UserBookingHistory } from './user/UserBookingHistory';

// Admin pages
import { AdminPendingRequests } from './admin/AdminPendingRequests';
import { AdminBookingHistory } from './admin/AdminBookingHistory';
import { OccupancyView } from './admin/OccupancyView';
import { ResourceManagement } from './admin/ResourceManagement';

export function Dashboard() {
  const { user } = useAuth();
  // Initialize mode based on user access - admins start in admin mode, users in user mode
  const [isUserMode, setIsUserMode] = useState(user?.accessLevel === 'admin' ? false : true);
  const [activeUserTab, setActiveUserTab] = useState('book');
  const [activeAdminTab, setActiveAdminTab] = useState('pending');
  const [showGenderModal, setShowGenderModal] = useState(!user?.gender);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Update mode when user changes (in case of re-authentication)
  useEffect(() => {
    if (user?.accessLevel === 'admin') {
      // Admin users can switch between modes, default to admin mode
      setIsUserMode(false);
    } else {
      // Regular users are always in user mode
      setIsUserMode(true);
    }
  }, [user?.accessLevel]);

  const userTabs = [
    { key: 'requests', label: 'Requests' },
    { key: 'upcoming', label: 'Upcoming stays' },
    { key: 'history', label: 'Booking History' },
    { key: 'book', label: 'Book' },
  ];

  const adminTabs = [
    { key: 'pending', label: 'Pending Requests' },
    { key: 'history', label: 'Booking History' },
    { key: 'occupancy', label: 'Occupancy View' },
    { key: 'resources', label: 'System Management' },
  ];

  const renderUserContent = () => {
    switch (activeUserTab) {
      case 'book':
        return <UserBooking />;
      case 'requests':
        return <UserPendingRequests />;
      case 'upcoming':
        return <UserUpcomingBookings />;
      case 'history':
        return <UserBookingHistory />;
      default:
        return <UserBooking />;
    }
  };

  const renderAdminContent = () => {
    switch (activeAdminTab) {
      case 'pending':
        return <AdminPendingRequests />;
      case 'history':
        return <AdminBookingHistory />;
      case 'occupancy':
        return <OccupancyView />;
      case 'resources':
        return <ResourceManagement />;
      default:
        return <AdminPendingRequests />;
    }
  };

  const handleModeToggle = () => {
    setIsUserMode(!isUserMode);
    // Reset active tabs when switching modes
    if (isUserMode) {
      setActiveAdminTab('pending');
    } else {
      setActiveUserTab('book');
    }
  };

  return (
    <Layout 
      showNavigation={true} 
      userMode={isUserMode}
      onToggleMode={user?.accessLevel === 'admin' ? handleModeToggle : undefined}
    >
      {isUserMode ? (
        <div className="space-y-6">
          <TabNavigation
            tabs={userTabs}
            activeTab={activeUserTab}
            onTabChange={setActiveUserTab}
            className="max-w-md mx-auto"
          />
          {renderUserContent()}
        </div>
      ) : (
        <div className="space-y-6">
          <TabNavigation
            tabs={adminTabs}
            activeTab={activeAdminTab}
            onTabChange={setActiveAdminTab}
            className="max-w-2xl mx-auto"
          />
          {renderAdminContent()}
        </div>
      )}

      <GenderSelectionModal
        isOpen={showGenderModal}
        onClose={() => setShowGenderModal(false)}
      />

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </Layout>
  );
}