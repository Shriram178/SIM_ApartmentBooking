import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { BookingRequest, City } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { TeamMembersModal } from '../../components/TeamMembersModal';
import { Building, Home, Bed, Users, Calendar, Filter, X, MapPin } from 'lucide-react';

export function UserBookingHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BookingRequest[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<any[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    city: '',
    status: '',
  });

  useEffect(() => {
    if (user) {
      loadBookingHistory();
      loadCities();
    }
  }, [user]);

  const loadCities = async () => {
    try {
      setIsLoadingCities(true);
      const citiesData = await apiService.getCities();
      setCities(citiesData);
    } catch (error) {
      console.error('Failed to load cities:', error);
    } finally {
      setIsLoadingCities(false);
    }
  };

  const loadBookingHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Apply filters if any are set
      const queryFilters = Object.entries(filters)
        .filter(([_, value]) => value.trim() !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
      
      const response = await apiService.getUserBookingHistory(user.id);
      setHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load booking history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      city: '',
      status: '',
    });
  };

  const applyFilters = () => {
    loadBookingHistory();
    setShowFilters(false);
  };

  // Filter history based on current filters
  const filteredHistory = history.filter(request => {
    if (filters.city && request.cityName !== cities.find(c => c.id.toString() === filters.city)?.name) {
      return false;
    }
    if (filters.status && request.status !== filters.status) {
      return false;
    }
    return true;
  });

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

  const calculateDuration = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  const renderAccommodation = (accommodation: any) => {
    if (!accommodation || (!accommodation.apartment && !accommodation.flat && !accommodation.room && !accommodation.bed)) {
      return null;
    }

    return (
      <div className="flex items-center space-x-1">
        {accommodation.apartment && (
          <Building size={12} className="text-blue-600" />
        )}
        {accommodation.flat && (
          <Home size={12} className="text-green-600" />
        )}
        {accommodation.room && (
          <div className="w-3 h-3 bg-orange-600 rounded-sm" />
        )}
        {accommodation.bed && (
          <Bed size={12} className="text-purple-600" />
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Booking History</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <select
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
                disabled={isLoadingCities}
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
                <option value="accommodated">Accommodated</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear Filters
              </button>
              <button
                onClick={applyFilters}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
        
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {history.length === 0 ? 'No booking history found' : 'No bookings match the selected filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accommodation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHistory.map((request) => {
                  const userMember = request.bookingMembers.find(member => member.userId === user?.id);
                  
                  return (
                    <tr key={request.requestId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDateTime(request.requestedAt).date}
                        <div className="text-xs text-gray-500">
                          {formatDateTime(request.requestedAt).time}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{request.requestedUser.name}</div>
                        <div className="text-xs text-gray-500">{request.requestedUser.role}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {request.cityName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {userMember && (
                          <div>
                            <div className="text-gray-900">
                              {formatDateTime(userMember.checkIn || '').date} - {formatDateTime(userMember.checkOut || '').date}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDateTime(userMember.checkIn || '').time} - {formatDateTime(userMember.checkOut || '').time}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {userMember && calculateDuration(userMember.checkIn || '', userMember.checkOut || '')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={request.status || 'pending'} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-2">
                          {userMember && renderAccommodation(userMember.accommodation)}
                          {/* Map link would go here if available in API */}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-900 capitalize">{request.bookingType}</span>
                          {request.bookingType === 'team' && (
                            <button
                              onClick={() => showTeamMembers(request.bookingMembers)}
                              className="text-blue-600 hover:text-blue-700 text-xs"
                            >
                              ({request.bookingMembers.length} members)
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {request.processedAt ? formatDateTime(request.processedAt).date : 'Pending'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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