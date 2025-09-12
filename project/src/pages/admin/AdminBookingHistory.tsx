import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { City } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { Download, Filter, X, Calendar } from 'lucide-react';

export function AdminBookingHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    status: '',
    role: '',
    checkIn: '',
    checkOut: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadBookingHistory();
    loadCities();
  }, []);

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
    try {
      setIsLoading(true);
      const queryFilters = Object.entries(filters)
        .filter(([_, value]) => value.trim() !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      const response = await apiService.getBookingHistory(queryFilters);
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
      search: '',
      city: '',
      status: '',
      role: '',
      checkIn: '',
      checkOut: '',
    });
  };

  const applyFilters = () => {
    loadBookingHistory();
    setShowFilters(false);
  };

  const exportToExcel = () => {
    // This would trigger the export functionality
    alert('Exporting to Excel...');
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { date: 'N/A', time: 'N/A' };
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const calculateDuration = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 'N/A';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  // Calculate statistics
  const stats = {
    total: history.length,
    approved: history.filter(h => h.status === 'accommodated' || h.status === 'completed').length,
    rejected: history.filter(h => h.status === 'rejected').length,
    team: history.filter(h => h.bookingType === 'team').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Requests</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.team}</div>
          <div className="text-sm text-gray-600">Team Bookings</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Booking History ({history.length} processed requests)
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Filter size={14} />
              <span>Filters</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Download size={14} />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <input
                type="text"
                placeholder="Name, email, city..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
              />
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
              </select>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
              >
                <option value="">All Roles</option>
                <option value="Manager">Manager</option>
                <option value="Lead">Lead</option>
                <option value="Project Engineer">Project Engineer</option>
              </select>
              <input
                type="date"
                placeholder="From Date"
                value={filters.checkIn}
                onChange={(e) => handleFilterChange('checkIn', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
              />
              <input
                type="date"
                placeholder="To Date"
                value={filters.checkOut}
                onChange={(e) => handleFilterChange('checkOut', e.target.value)}
                className="p-2 border border-gray-300 rounded text-sm"
              />
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

        {/* History Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accommodation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((request) => (
                  <tr key={request.requestId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {formatDateTime(request.requestedAt).date}
                      <div className="text-xs text-gray-500">
                        {formatDateTime(request.requestedAt).time}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-gray-900">{request.requestedBy.name}</div>
                      <div className="text-xs text-gray-500">{request.requestedBy.email}</div>
                      <div className="text-xs text-gray-500">{request.requestedBy.role}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{request.city}</td>
                    <td className="px-4 py-3 text-sm">
                      {request.bookingMembers[0] && (
                        <div>
                          {formatDateTime(request.bookingMembers[0].checkIn).date} - {formatDateTime(request.bookingMembers[0].checkOut).date}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {request.bookingMembers[0] && 
                        calculateDuration(request.bookingMembers[0].checkIn, request.bookingMembers[0].checkOut)
                      }
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {request.bookingMembers[0]?.assignedAccommodation ? (
                        <div className="text-blue-600 text-xs">
                          {Object.values(request.bookingMembers[0].assignedAccommodation)
                            .filter(Boolean)
                            .join(' - ') || 'Not assigned'}
                        </div>
                      ) : (
                        <span className="text-gray-500">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="capitalize">{request.bookingType}</span>
                      {request.bookingType === 'team' && (
                        <div className="text-xs text-gray-500">
                          {request.bookingMembers.length} members
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {request.processedAt ? formatDateTime(request.processedAt).date : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}