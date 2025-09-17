import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Plus, Edit2, Trash2, X, Download, Building, Home, Bed, Layers } from 'lucide-react';

interface City {
  id: number;
  name: string;
}

interface Apartment {
  id: number;
  name: string;
  googleMapLink?: string;
  statistics: {
    flats: number;
    rooms: number;
    beds: number;
  };
}

interface Flat {
  id: number;
  name: string;
  rooms?: Room[];
}

interface Room {
  id: number;
  name: string;
  beds?: any[];
}

interface ResourceData {
  cities: City[];
  selectedCity: City | null;
  apartments: Apartment[];
  selectedApartment: Apartment | null;
  flats: Flat[];
  selectedFlat: Flat | null;
  rooms: Room[];
}

export function ResourceManagement() {
  const [resources, setResources] = useState<ResourceData>({
    cities: [],
    selectedCity: null,
    apartments: [],
    selectedApartment: null,
    flats: [],
    selectedFlat: null,
    rooms: [],
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [modalLevel, setModalLevel] = useState<'city' | 'apartment' | 'flat' | 'room'>('city');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [formData, setFormData] = useState({
    cityName: '',
    apartmentName: '',
    apartmentMapLink: '',
    flatName: '',
    rooms: [{ name: 'Room 1', bedCount: 2 }],
  });
  const [bulkFormData, setBulkFormData] = useState({
    cityName: '',
    apartmentName: '',
    apartmentMapLink: '',
    flatName: '',
    rooms: [{ name: 'Room 1', bedCount: 2 }],
  });

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      setIsLoading(true);
      const cities = await apiService.getCities();
      setResources(prev => ({ ...prev, cities }));
    } catch (error) {
      console.error('Failed to load cities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadApartmentsByCity = async (cityId: number) => {
    try {
      const response = await apiService.getApartmentsByCity(cityId);
      const selectedCity = resources.cities.find(c => c.id === cityId) || null;
      setResources(prev => ({
        ...prev,
        apartments: response.data.apartments || [],
        selectedCity,
        selectedApartment: null,
        flats: [],
        selectedFlat: null,
        rooms: []
      }));
    } catch (error) {
      console.error('Failed to load apartments:', error);
    }
  };

  const loadFlatsByApartment = async (apartment: Apartment) => {
    try {
      const response = await apiService.getFlatsByApartment(apartment.id);
      setResources(prev => ({
        ...prev,
        selectedApartment: apartment,
        flats: response.data.flats || [],
        selectedFlat: null,
        rooms: []
      }));
    } catch (error) {
      console.error('Failed to load flats:', error);
    }
  };

  const loadRoomsByFlat = async (flat: Flat) => {
  try {
    const response = await apiService.getFlatDetails(flat.id);

    const flatData = response.data; // this is the flat object with rooms

    setResources(prev => ({
      ...prev,
      selectedFlat: flatData,     // use flatData instead of flat
      rooms: flatData.rooms || []
    }));
  } catch (error) {
    console.error('Failed to load rooms:', error);
  }
};



  const openModal = (level: 'city' | 'apartment' | 'flat' | 'room', mode: 'add' | 'edit' = 'add', item?: any) => {
    setModalLevel(level);
    setModalMode(mode);
    setEditingItem(item);
    setShowModal(true);
    
    if (mode === 'edit' && item) {
      setFormData({
        cityName: item.name || '',
        apartmentName: item.name || '',
        apartmentMapLink: item.googleMapLink || '',
        flatName: item.name || '',
        rooms: [{ name: 'Room 1', bedCount: 2 }],
      });
    } else {
      resetFormData();
    }
  };

  const resetFormData = () => {
    setFormData({
      cityName: '',
      apartmentName: '',
      apartmentMapLink: '',
      flatName: '',
      rooms: [{ name: 'Room 1', bedCount: 2 }],
    });
  };

  const addRoom = () => {
    setFormData(prev => ({
      ...prev,
      rooms: [...prev.rooms, { name: `Room ${prev.rooms.length + 1}`, bedCount: 2 }]
    }));
  };

  const removeRoom = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index)
    }));
  };

  const updateRoom = (index: number, field: 'name' | 'bedCount', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) => 
        i === index ? { ...room, [field]: value } : room
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        await handleCreateAccommodation();
      } else {
        await handleEditAccommodation();
      }

      setShowModal(false);
      resetFormData();
      setEditingItem(null);
      
      // Reload data
      await loadCities();
      if (resources.selectedCity) {
        await loadApartmentsByCity(resources.selectedCity.id);
      }
      if (resources.selectedApartment) {
        await loadFlatsByApartment(resources.selectedApartment);
      }
      
      alert(`Resource ${modalMode === 'edit' ? 'updated' : 'created'} successfully`);
    } catch (error) {
      alert(`Failed to ${modalMode} resource`);
    }
  };

  const handleCreateAccommodation = async () => {
    const accommodationData: any = {};

    // City creation
    if (modalLevel === 'city') {
      accommodationData.cityData = { name: formData.cityName };
    }

    // Apartment creation
    if (modalLevel === 'apartment') {
      accommodationData.apartmentData = {
        name: formData.apartmentName,
        google_map_link: formData.apartmentMapLink,
        city_id: resources.selectedCity?.id
      };
    }

    // Flat creation
    if (modalLevel === 'flat') {
      accommodationData.flatData = {
        name: formData.flatName,
        apartment_id: resources.selectedApartment?.id
      };
      // Add rooms if specified
      if (formData.rooms.length > 0) {
        accommodationData.roomData = formData.rooms.map(room => ({
          name: room.name,
          bedCount: room.bedCount
        }));
      }
    }

    // Room creation
    if (modalLevel === 'room') {
      accommodationData.roomData = formData.rooms.map(room => ({
        name: room.name,
        bedCount: room.bedCount,
        flat_id: resources.selectedFlat?.id
      }));
    }

    await apiService.createAccommodation(accommodationData);
  };

  const handleEditAccommodation = async () => {
    if (modalLevel === 'city' && editingItem) {
      await apiService.updateCity(editingItem.id, formData.cityName);
      await loadCities();
    } else if (modalLevel === 'apartment' && editingItem) {
      await apiService.updateApartment(editingItem.id, {
        name: formData.apartmentName,
        googleMapLink: formData.apartmentMapLink
      });
      if (resources.selectedCity) {
        await loadApartmentsByCity(resources.selectedCity.id);
      }
    } else if (modalLevel === 'flat' && editingItem) {
      await apiService.updateFlat(editingItem.id, formData.flatName);
      if (resources.selectedApartment) {
        await loadFlatsByApartment(resources.selectedApartment);
      }
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const accommodationData = {
        cityData: { name: bulkFormData.cityName },
        apartmentData: {
          name: bulkFormData.apartmentName,
          google_map_link: bulkFormData.apartmentMapLink
        },
        flatData: { name: bulkFormData.flatName },
        roomData: bulkFormData.rooms.map(room => ({
          name: room.name,
          bedCount: room.bedCount
        }))
      };

      await apiService.createAccommodation(accommodationData);
      setShowBulkAdd(false);
      setBulkFormData({
        cityName: '',
        apartmentName: '',
        apartmentMapLink: '',
        flatName: '',
        rooms: [{ name: 'Room 1', bedCount: 2 }],
      });
      
      await loadCities();
      alert('Full hierarchy created successfully');
    } catch (error) {
      alert('Failed to create hierarchy');
    }
  };

  const addBulkRoom = () => {
    setBulkFormData(prev => ({
      ...prev,
      rooms: [...prev.rooms, { name: `Room ${prev.rooms.length + 1}`, bedCount: 2 }]
    }));
  };

  const removeBulkRoom = (index: number) => {
    setBulkFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index)
    }));
  };

  const updateBulkRoom = (index: number, field: 'name' | 'bedCount', value: string | number) => {
    setBulkFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) => 
        i === index ? { ...room, [field]: value } : room
      )
    }));
  };

  const deleteCity = async (cityId: number) => {
    if (confirm('Are you sure you want to delete this city? All associated data will be lost.')) {
      try {
        await apiService.deleteCity(cityId);
        await loadCities();
        setResources(prev => ({
          ...prev,
          selectedCity: null,
          apartments: [],
          selectedApartment: null,
          flats: [],
          selectedFlat: null,
          rooms: []
        }));
        alert('City deleted successfully');
      } catch (error) {
        alert('Failed to delete city');
      }
    }
  };

  const deleteApartment = async (apartmentId: number) => {
    if (confirm('Are you sure you want to delete this apartment? All associated data will be lost.')) {
      try {
        await apiService.deleteApartment(apartmentId);
        if (resources.selectedCity) {
          await loadApartmentsByCity(resources.selectedCity.id);
        }
        setResources(prev => ({
          ...prev,
          selectedApartment: null,
          flats: [],
          selectedFlat: null,
          rooms: []
        }));
        alert('Apartment deleted successfully');
      } catch (error) {
        alert('Failed to delete apartment');
      }
    }
  };

  const deleteFlat = async (flatId: number) => {
    if (confirm('Are you sure you want to delete this flat? All associated data will be lost.')) {
      try {
        await apiService.deleteFlat(flatId);
        if (resources.selectedApartment) {
          await loadFlatsByApartment(resources.selectedApartment);
        }
        setResources(prev => ({
          ...prev,
          selectedFlat: null,
          rooms: []
        }));
        alert('Flat deleted successfully');
      } catch (error) {
        alert('Failed to delete flat');
      }
    }
  };

  const deleteRoom = async (roomId: number) => {
    if (confirm('Are you sure you want to delete this room? All associated beds will be lost.')) {
      try {
        await apiService.deleteRoom(roomId);
        if (resources.selectedFlat) {
          await loadRoomsByFlat(resources.selectedFlat);
        }
        alert('Room deleted successfully');
      } catch (error) {
        alert('Failed to delete room');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Manage Resources</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowBulkAdd(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              <Layers size={14} />
              <span>Bulk Add</span>
            </button>
            {/* <button
              onClick={() => alert('Exporting resources to Excel...')}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Download size={14} />
              <span>Export</span>
            </button> */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cities */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Cities</h3>
              <button
                onClick={() => openModal('city')}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
            
            <div className="space-y-2">
              {resources.cities.map(city => (
                <div
                  key={city.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    resources.selectedCity?.id === city.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => loadApartmentsByCity(city.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{city.name}</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('city', 'edit', city);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCity(city.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apartments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Apartments {resources.selectedCity && `(${resources.selectedCity.name})`}
              </h3>
              {resources.selectedCity && (
                <button
                  onClick={() => openModal('apartment')}
                  className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            
            {!resources.selectedCity ? (
              <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
                Select a city to view apartments
              </div>
            ) : (
              <div className="space-y-2">
                {resources.apartments.map(apartment => (
                  <div
                    key={apartment.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      resources.selectedApartment?.id === apartment.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => loadFlatsByApartment(apartment)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{apartment.name}</div>
                        <div className="text-xs text-gray-500">
                          {apartment.statistics.flats} flats, {apartment.statistics.rooms} rooms, {apartment.statistics.beds} beds
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('apartment', 'edit', apartment);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteApartment(apartment.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flats */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Flats {resources.selectedApartment && `(${resources.selectedApartment.name})`}
              </h3>
              {resources.selectedApartment && (
                <button
                  onClick={() => openModal('flat')}
                  className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            
            {!resources.selectedApartment ? (
              <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
                Select an apartment to view flats
              </div>
            ) : (
              <div className="space-y-2">
                {resources.flats.map(flat => (
                  <div
                    key={flat.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      resources.selectedFlat?.id === flat.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => loadRoomsByFlat(flat)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{flat.name}</div>
                        <div className="text-xs text-gray-500">
                          {flat.statistics?.rooms || 0} rooms
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('flat', 'edit', flat);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFlat(flat.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rooms & Beds */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Rooms & Beds {resources.selectedFlat && `(${resources.selectedFlat.name})`}
              </h3>
              {resources.selectedFlat && (
                <button
                  onClick={() => openModal('room')}
                  className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            
            {!resources.selectedFlat ? (
              <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
                Select a flat to view rooms
              </div>
            ) : (
              <div className="space-y-2">
                {resources.rooms.map(room => (
                  <div key={room.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{room.name}</div>
                        <div className="text-xs text-gray-500">
                          {room.bedCount || 0} beds
                        </div>
                      </div>
                      {/* <div className="flex space-x-1">
                        <button
                          onClick={() => openModal('room', 'edit', room)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => deleteRoom(room.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div> */}
                    </div>
                    
                    {room.bedCount && room.bedCount > 0 && (
                      <div className="space-y-1">
                        {Array.from({ length: room.bedCount }, (_, index) => (
                          <div key={index} className="flex items-center space-x-2 text-xs text-gray-600">
                            <Bed size={12} />
                            <span>Bed {index + 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                {modalMode === 'add' ? 'Add' : 'Edit'} {modalLevel}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* City Field */}
              {(modalLevel === 'city' || (modalLevel !== 'city' && !resources.selectedCity)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City Name *</label>
                  <input
                    type="text"
                    value={formData.cityName}
                    onChange={(e) => setFormData(prev => ({ ...prev, cityName: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    required
                  />
                </div>
              )}

              {/* Apartment Field */}
              {(modalLevel === 'apartment') && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apartment Name *</label>
                    <input
                      type="text"
                      value={formData.apartmentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, apartmentName: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Map Link</label>
                    <input
                      type="url"
                      value={formData.apartmentMapLink}
                      onChange={(e) => setFormData(prev => ({ ...prev, apartmentMapLink: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Flat Field */}
              {(modalLevel === 'flat') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flat Name *</label>
                  <input
                    type="text"
                    value={formData.flatName}
                    onChange={(e) => setFormData(prev => ({ ...prev, flatName: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    required
                  />
                </div>
              )}

              {/* Rooms Section */}
              {modalMode === 'add' && (modalLevel === 'flat' || modalLevel === 'room') && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Rooms</label>
                    <button
                      type="button"
                      onClick={addRoom}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                    >
                      <Plus size={12} />
                      <span>Add Room</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formData.rooms.map((room, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => updateRoom(index, 'name', e.target.value)}
                          placeholder="Room name"
                          className="flex-1 p-2 border border-gray-300 rounded text-sm"
                        />
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700">Beds:</span>
                          <button
                            type="button"
                            onClick={() => updateRoom(index, 'bedCount', Math.max(1, room.bedCount - 1))}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm">{room.bedCount}</span>
                          <button
                            type="button"
                            onClick={() => updateRoom(index, 'bedCount', room.bedCount + 1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>

                        {formData.rooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRoom(index)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {modalMode === 'add' ? 'Create' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Create Full Hierarchy</h3>
              <button
                onClick={() => setShowBulkAdd(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City Name *</label>
                <input
                  type="text"
                  value={bulkFormData.cityName}
                  onChange={(e) => setBulkFormData(prev => ({ ...prev, cityName: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartment Name *</label>
                  <input
                    type="text"
                    value={bulkFormData.apartmentName}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, apartmentName: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Map Link</label>
                  <input
                    type="url"
                    value={bulkFormData.apartmentMapLink}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, apartmentMapLink: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flat Name *</label>
                <input
                  type="text"
                  value={bulkFormData.flatName}
                  onChange={(e) => setBulkFormData(prev => ({ ...prev, flatName: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Rooms</label>
                  <button
                    type="button"
                    onClick={addBulkRoom}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                  >
                    <Plus size={12} />
                    <span>Add Room</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {bulkFormData.rooms.map((room, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateBulkRoom(index, 'name', e.target.value)}
                        placeholder="Room name"
                        className="flex-1 p-2 border border-gray-300 rounded text-sm"
                      />
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">Beds:</span>
                        <button
                          type="button"
                          onClick={() => updateBulkRoom(index, 'bedCount', Math.max(1, room.bedCount - 1))}
                          className="w-6 h-6 flex items-center justify-center text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm">{room.bedCount}</span>
                        <button
                          type="button"
                          onClick={() => updateBulkRoom(index, 'bedCount', room.bedCount + 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>

                      {bulkFormData.rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBulkRoom(index)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkAdd(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Hierarchy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}