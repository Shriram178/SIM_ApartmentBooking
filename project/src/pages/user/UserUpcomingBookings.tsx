import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { BookingRequest } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { TeamMembersModal } from '../../components/TeamMembersModal';
import { Building, Home, Bed, Users, MapPin, DoorOpen } from 'lucide-react';

export function UserUpcomingBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<any[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadUpcomingBookings();
    }
  }, [user]);

  const loadUpcomingBookings = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await apiService.getUserUpcomingBookings(user.id);
      setBookings(response.data || []);
    } catch (error) {
      console.error('Failed to load upcoming bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (requestId: number, userId: number) => {
    try {
      await apiService.cancelUserBooking(requestId, userId);
      await loadUpcomingBookings();
      alert('Booking cancelled successfully');
    } catch (error) {
      alert('Failed to cancel booking');
    }
  };

  const showTeamMembers = (members: any[]) => {
    setSelectedTeamMembers(members);
    setShowTeamModal(true);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const renderAccommodation = (accommodation: any) => {
    if (!accommodation || (!accommodation.apartment && !accommodation.flat && !accommodation.room && !accommodation.bed)) {
      return (
        <div className="text-gray-500 text-sm">
          Not assigned
        </div>
      );
    }

    // Build the accommodation path without category descriptors
    const parts = [];
    let icon = null;

    // Always include apartment name if available
    if (accommodation.apartment?.name) {
      parts.push(accommodation.apartment.name);
    }

    // Determine the most specific allocation type and build path accordingly
    if (accommodation.bed?.name) {
      // Bed allocation - show apartment -> flat
      if (accommodation.flat?.name) {
        parts.push(accommodation.flat.name);
      }
      icon = <Bed size={14} className="text-purple-600" />;
    } else if (accommodation.room?.name) {
      // Room allocation - show apartment -> flat
      if (accommodation.flat?.name) {
        parts.push(accommodation.flat.name);
      }
      icon = <DoorOpen size={14} className="text-orange-600" />;
    } else if (accommodation.flat?.name) {
      // Flat allocation - show apartment -> flat
      parts.push(accommodation.flat.name);
      icon = <Home size={14} className="text-green-600" />;
    } else {
      // Apartment allocation - show just apartment
      icon = <Building size={14} className="text-blue-600" />;
    }

    const accommodationText = parts.join(' -> ');

    return (
      <div className="flex items-center space-x-1">
        {icon}
        <span className="text-sm text-gray-900">{accommodationText}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Legends */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legends</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <Building size={14} className="text-blue-600" />
            <span>Apartment</span>
          </div>
          <div className="flex items-center space-x-2">
            <Home size={14} className="text-green-600" />
            <span>Flat</span>
          </div>
          <div className="flex items-center space-x-2">
            <DoorOpen size={14} className="text-orange-600" />
            <span>Room</span>
          </div>
          <div className="flex items-center space-x-2">
            <Bed size={14} className="text-purple-600" />
            <span>Bed</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Bookings</h2>
        
        {bookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No upcoming bookings found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const userMember = booking.bookingMembers.find(member => member.userId === user?.id);
              
              return (
                <div key={booking.requestId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <StatusBadge status="approved" />
                        <span className="text-sm font-medium text-gray-900">
                          {booking.cityName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {booking.bookingType === 'individual' ? 'Individual' : `Team (${booking.bookingMembers.length})`}
                        </span>
                      </div>

                      {userMember && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Check-in:</span>
                            <div className="text-gray-900">
                              {formatDateTime(userMember.checkIn || '').date}
                              <span className="text-xs text-gray-500 ml-1">
                                {formatDateTime(userMember.checkIn || '').time}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Check-out:</span>
                            <div className="text-gray-900">
                              {formatDateTime(userMember.checkOut || '').date}
                              <span className="text-xs text-gray-500 ml-1">
                                {formatDateTime(userMember.checkOut || '').time}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Accommodation:</span>
                            <div className="mt-1 flex items-center space-x-2">
                              <div className="flex items-center space-x-1">
                                {renderAccommodation(userMember.accommodation)}
                              </div>
                              {/* Map link would go here if available in API */}
                            </div>
                          </div>
                        </div>
                      )}

                      {booking.bookingType === 'team' && (
                        <button
                          onClick={() => showTeamMembers(booking.bookingMembers)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <Users size={14} />
                          <span>View Team Members</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleCancelBooking(booking.requestId, user!.id)}
                      className="ml-4 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TeamMembersModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        members={selectedTeamMembers}
      />
    </div>
  );
}