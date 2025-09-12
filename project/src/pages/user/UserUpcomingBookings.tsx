import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { BookingRequest } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { Building, Home, Bed, Users } from 'lucide-react';

export function UserUpcomingBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set());

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

  const toggleExpanded = (requestId: number) => {
    const newExpanded = new Set(expandedBookings);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedBookings(newExpanded);
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
      return <span className="text-gray-500">Not assigned</span>;
    }

    return (
      <div className="flex items-center space-x-2 text-sm">
        {accommodation.apartment && (
          <div className="flex items-center space-x-1">
            <Building size={14} className="text-blue-600" />
            <span>{accommodation.apartment.name}</span>
          </div>
        )}
        {accommodation.flat && (
          <div className="flex items-center space-x-1">
            <Home size={14} className="text-green-600" />
            <span>{accommodation.flat.name}</span>
          </div>
        )}
        {accommodation.room && (
          <div className="flex items-center space-x-1">
            <div className="w-3.5 h-3.5 bg-orange-600 rounded-sm" />
            <span>{accommodation.room.name}</span>
          </div>
        )}
        {accommodation.bed && (
          <div className="flex items-center space-x-1">
            <Bed size={14} className="text-purple-600" />
            <span>{accommodation.bed.name}</span>
          </div>
        )}
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
            <div className="w-3.5 h-3.5 bg-orange-600 rounded-sm" />
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
              const isExpanded = expandedBookings.has(booking.requestId);
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
                            <div className="mt-1">
                              {renderAccommodation(userMember.accommodation)}
                            </div>
                          </div>
                        </div>
                      )}

                      {booking.bookingType === 'team' && (
                        <button
                          onClick={() => toggleExpanded(booking.requestId)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <Users size={14} />
                          <span>{isExpanded ? 'Hide' : 'View'} Team Members</span>
                        </button>
                      )}

                      {isExpanded && booking.bookingType === 'team' && (
                        <div className="mt-4 space-y-2">
                          {booking.bookingMembers.map((member, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-md">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{member.username}</div>
                                  <div className="text-xs text-gray-500">{member.role}</div>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {formatDateTime(member.checkIn || '').date} - {formatDateTime(member.checkOut || '').date}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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
    </div>
  );
}