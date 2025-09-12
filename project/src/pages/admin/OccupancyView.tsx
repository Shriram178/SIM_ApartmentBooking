import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { City } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { Download, Calendar } from 'lucide-react';

export function OccupancyView() {
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [filters, setFilters] = useState({
    city: '',
    apartment: '',
    status: '',
  });
  const [dateRange, setDateRange] = useState({
    checkIn: '',
    checkOut: '',
  });

  useEffect(() => {
    loadOccupancyData();
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

  const loadOccupancyData = async () => {
    try {
      setIsLoading(true);
      const queryFilters = Object.entries(filters)
        .filter(([_, value]) => value.trim() !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      const body = dateRange.checkIn && dateRange.checkOut ? {
        checkIn: `${dateRange.checkIn}T09:00:00Z`,
        checkOut: `${dateRange.checkOut}T18:00:00Z`
      } : undefined;

      const response = await apiService.getOccupancy(queryFilters, body);
      setOccupancyData(response);
    } catch (error) {
      console.error('Failed to load occupancy data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateChange = (key: string, value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      city: '',
      apartment: '',
      status: '',
    });
    setDateRange({
      checkIn: '',
      checkOut: '',
    });
  };

  const exportToExcel = () => {
    alert('Exporting occupancy data to Excel...');
  };

  const flattenAccommodations = (hierarchy: any[]) => {
    const flattened: any[] = [];
    
    hierarchy.forEach(city => {
      city.apartments?.forEach((apartment: any) => {
        apartment.flats?.forEach((flat: any) => {
          // Add flat-level entry if it has occupiedBy data
          if (flat.occupiedBy) {
            flattened.push({
              city: city.name,
              apartment: apartment.name,
              flat: flat.name,
              room: '-',
              bed: '-',
              status: flat.status,
              occupiedBy: flat.occupiedBy,
            });
          }
          
          flat.rooms?.forEach((room: any) => {
            // Add room-level entry if it has occupiedBy data
            if (room.occupiedBy) {
              flattened.push({
                city: city.name,
                apartment: apartment.name,
                flat: flat.name,
                room: room.name,
                bed: '-',
                status: room.status,
                occupiedBy: room.occupiedBy,
              });
            }
            
            room.beds?.forEach((bed: any) => {
              flattened.push({
                city: city.name,
                apartment: apartment.name,
                flat: flat.name,
                room: room.name,
                bed: bed.name,
                status: bed.status,
                occupiedBy: bed.occupiedBy,
              });
            });
          });
        });
      });
    });
    
    return flattened;
  };

  const accommodationList = occupancyData?.data?.hierarchy ? flattenAccommodations(occupancyData.data.hierarchy) : [];
  const stats = occupancyData?.data?.statistics || { totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, occupancyRate: '0%' };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.totalBeds}</div>
          <div className="text-sm text-gray-600">Total Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.occupiedBeds}</div>
          <div className="text-sm text-gray-600">Occupied</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.vacantBeds}</div>
          <div className="text-sm text-gray-600">Available</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.occupancyRate}</div>
          <div className="text-sm text-gray-600">Occupancy Rate</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
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
            value={filters.apartment}
            onChange={(e) => handleFilterChange('apartment', e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Apartments</option>
            <option value="1">Apt1</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Status</option>
            <option value="occupied">Occupied</option>
            <option value="vacant">Available</option>
          </select>

          <input
            type="date"
            placeholder="From Date"
            value={dateRange.checkIn}
            onChange={(e) => handleDateChange('checkIn', e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          />

          <input
            type="date"
            placeholder="To Date"
            value={dateRange.checkOut}
            onChange={(e) => handleDateChange('checkOut', e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          />

          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Clear
          </button>

          <button
            onClick={loadOccupancyData}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply
          </button>

          <button
            onClick={exportToExcel}
            className="ml-auto flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download size={14} />
            <span>Export to Excel</span>
          </button>
        </div>

        {/* Occupancy Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apartment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accommodationList.map((accommodation, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{accommodation.apartment}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{accommodation.flat}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{accommodation.room}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{accommodation.bed}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={accommodation.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {accommodation.occupiedBy ? (
                        <div>
                          <div className="text-gray-900">{accommodation.occupiedBy.user.name}</div>
                          <div className="text-xs text-gray-500">{accommodation.occupiedBy.user.role}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {accommodation.occupiedBy?.period?.checkIn 
                        ? new Date(accommodation.occupiedBy.period.checkIn).toLocaleDateString()
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {accommodation.occupiedBy?.period?.checkOut
                        ? new Date(accommodation.occupiedBy.period.checkOut).toLocaleDateString()
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {accommodation.occupiedBy?.period?.checkIn && accommodation.occupiedBy?.period?.checkOut
                        ? calculateDuration(accommodation.occupiedBy.period.checkIn, accommodation.occupiedBy.period.checkOut)
                        : '-'
                      }
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

  function calculateDuration(checkIn: string, checkOut: string): string {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}