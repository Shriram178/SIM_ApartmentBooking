import pool from '../db.js';
import ExcelJS from 'exceljs';

export const getOccupancy = async (req, res) => {
  const { checkIn, checkOut } = req.body;
  const { city, apartment, status } = req.query;
  const client = await pool.connect();

  try {
    // Validate date range
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range - checkIn must be before checkOut'
      });
    }

    // Build the main query to get occupancy status
    let query = `
      WITH active_assignments AS (
        SELECT 
          aa.*,
          bm.check_in,
          bm.check_out,
          bm.user_id,
          req.status AS request_status,
          CASE 
            WHEN aa.bed_id IS NOT NULL THEN 'bed'
            WHEN aa.room_id IS NOT NULL THEN 'room'
            WHEN aa.flat_id IS NOT NULL THEN 'flat'
            WHEN aa.apartment_id IS NOT NULL THEN 'apartment'
            WHEN aa.city_id IS NOT NULL THEN 'city'
          END AS assignment_level
        FROM assigned_accommodations aa
        JOIN booking_members bm ON bm.id = aa.booking_members_id
        JOIN requests req ON req.id = bm.request_id
        WHERE req.status = 'approved'
          AND NOT (bm.check_out <= $1 OR bm.check_in >= $2)
      )
      
      SELECT 
        c.id AS city_id,
        c.name AS city_name,
        apt.id AS apartment_id,
        apt.name AS apartment_name,
        f.id AS flat_id,
        f.name AS flat_name,
        r.id AS room_id,
        r.name AS room_name,
        b.id AS bed_id,
        b.name AS bed_name,
        aa.assignment_level,
        aa.check_in,
        aa.check_out,
        aa.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        u.gender AS user_gender,
        CASE 
          WHEN aa.id IS NOT NULL THEN 'occupied'
          ELSE 'vacant'
        END AS status
      FROM cities c
      JOIN apartments apt ON apt.city_id = c.id
      JOIN flats f ON f.apartment_id = apt.id
      JOIN rooms r ON r.flat_id = f.id
      JOIN beds b ON b.room_id = r.id
      LEFT JOIN active_assignments aa ON (
        -- Match assignments at different levels
        (aa.assignment_level = 'bed' AND aa.bed_id = b.id) OR
        (aa.assignment_level = 'room' AND aa.room_id = r.id) OR
        (aa.assignment_level = 'flat' AND aa.flat_id = f.id) OR
        (aa.assignment_level = 'apartment' AND aa.apartment_id = apt.id) OR
        (aa.assignment_level = 'city' AND aa.city_id = c.id)
      )
      LEFT JOIN users u ON u.id = aa.user_id
    `;

    const params = [checkIn, checkOut];
    let whereClauses = [];
    let paramIndex = 3;

    // Add filters
    if (city) {
      whereClauses.push(`c.id = $${paramIndex++}`);
      params.push(city);
    }

    if (apartment) {
      whereClauses.push(`apt.id = $${paramIndex++}`);
      params.push(apartment);
    }

    if (status && status === 'occupied') {
      whereClauses.push(`aa.id IS NOT NULL`);
    } else if (status && status === 'vacant') {
      whereClauses.push(`aa.id IS NULL`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY c.name, apt.name, f.name, r.name, b.name`;

    const result = await client.query(query, params);

    // Transform results into hierarchical structure
    const hierarchy = {};

    result.rows.forEach(row => {
      // Initialize city
      if (!hierarchy[row.city_id]) {
        hierarchy[row.city_id] = {
          id: row.city_id,
          name: row.city_name,
          apartments: {},
          status: 'vacant',
          occupiedBy: null
        };
      }
      const city = hierarchy[row.city_id];

      // Initialize apartment
      if (!city.apartments[row.apartment_id]) {
        city.apartments[row.apartment_id] = {
          id: row.apartment_id,
          name: row.apartment_name,
          flats: {},
          status: 'vacant',
          occupiedBy: null
        };
      }
      const apartment = city.apartments[row.apartment_id];

      // Initialize flat
      if (!apartment.flats[row.flat_id]) {
        apartment.flats[row.flat_id] = {
          id: row.flat_id,
          name: row.flat_name,
          rooms: {},
          status: 'vacant',
          occupiedBy: null
        };
      }
      const flat = apartment.flats[row.flat_id];

      // Initialize room
      if (!flat.rooms[row.room_id]) {
        flat.rooms[row.room_id] = {
          id: row.room_id,
          name: row.room_name,
          beds: {},
          status: 'vacant',
          occupiedBy: null
        };
      }
      const room = flat.rooms[row.room_id];

      // Add bed
      if (!room.beds[row.bed_id]) {
        room.beds[row.bed_id] = {
          id: row.bed_id,
          name: row.bed_name,
          status: 'vacant',
          occupiedBy: null
        };
      }
      const bed = room.beds[row.bed_id];

      // Handle occupancy
      if (row.status === 'occupied') {
        const occupancyInfo = {
          user: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            role: row.user_role,
            gender: row.user_gender
          },
          period: {
            checkIn: row.check_in,
            checkOut: row.check_out
          },
          assignedLevel: row.assignment_level
        };

        // Update status based on assignment level
        switch (row.assignment_level) {
          case 'city':
            city.status = 'occupied';
            city.occupiedBy = occupancyInfo;
            // All children inherit occupied status
            apartment.status = 'occupied';
            flat.status = 'occupied';
            room.status = 'occupied';
            bed.status = 'occupied';
            break;
          case 'apartment':
            apartment.status = 'occupied';
            apartment.occupiedBy = occupancyInfo;
            // All children inherit occupied status
            flat.status = 'occupied';
            room.status = 'occupied';
            bed.status = 'occupied';
            break;
          case 'flat':
            flat.status = 'occupied';
            flat.occupiedBy = occupancyInfo;
            // All children inherit occupied status
            room.status = 'occupied';
            bed.status = 'occupied';
            break;
          case 'room':
            room.status = 'occupied';
            room.occupiedBy = occupancyInfo;
            // All children inherit occupied status
            bed.status = 'occupied';
            break;
          case 'bed':
            bed.status = 'occupied';
            bed.occupiedBy = occupancyInfo;
            break;
        }
      }
    });

    // Convert to array format and calculate statistics
    const cities = Object.values(hierarchy).map(city => ({
      ...city,
      apartments: Object.values(city.apartments).map(apartment => ({
        ...apartment,
        flats: Object.values(apartment.flats).map(flat => ({
          ...flat,
          rooms: Object.values(flat.rooms).map(room => ({
            ...room,
            beds: Object.values(room.beds)
          }))
        }))
      }))
    }));

    // Calculate statistics
    let totalBeds = 0;
    let occupiedBeds = 0;

    const countBeds = (units) => {
      units.forEach(unit => {
        if (unit.beds) {
          unit.beds.forEach(bed => {
            totalBeds++;
            if (bed.status === 'occupied') occupiedBeds++;
          });
        }
        if (unit.rooms) countBeds(unit.rooms);
        if (unit.flats) countBeds(unit.flats);
        if (unit.apartments) countBeds(unit.apartments);
      });
    };

    countBeds(cities);

    const response = {
      success: true,
      data: {
        period: { checkIn, checkOut },
        filters: { city: city || 'all', apartment: apartment || 'all', status: status || 'all' },
        statistics: {
          totalBeds,
          occupiedBeds,
          vacantBeds: totalBeds - occupiedBeds,
          occupancyRate: totalBeds > 0 ? (occupiedBeds / totalBeds * 100).toFixed(2) + '%' : '0%'
        },
        hierarchy: cities
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching occupancy:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve occupancy data",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const exportOccupancyToExcel = async (req, res) => {
  const { checkIn, checkOut } = req.body;
  const { city, apartment, status } = req.query;
  const client = await pool.connect();

  try {
    // Validate date range
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range - checkIn must be before checkOut'
      });
    }

    // Parse the exact times from the request body
    const checkInDate = parseExactTime(checkIn);
    const checkOutDate = parseExactTime(checkOut);

    // Build the main query with improved occupancy logic
    let query = `
      WITH active_assignments AS (
        SELECT 
          aa.*,
          bm.check_in,
          bm.check_out,
          bm.user_id,
          req.status AS request_status,
          CASE 
            WHEN aa.bed_id IS NOT NULL THEN 'bed'
            WHEN aa.room_id IS NOT NULL THEN 'room'
            WHEN aa.flat_id IS NOT NULL THEN 'flat'
            WHEN aa.apartment_id IS NOT NULL THEN 'apartment'
            WHEN aa.city_id IS NOT NULL THEN 'city'
          END AS assignment_level
        FROM assigned_accommodations aa
        JOIN booking_members bm ON bm.id = aa.booking_members_id
        JOIN requests req ON req.id = bm.request_id
        WHERE req.status = 'approved'
          AND bm.check_in < $2  -- check_in before requested check_out
          AND bm.check_out > $1 -- check_out after requested check_in
      ),
      
      -- Get all available accommodations
      all_accommodations AS (
        SELECT 
          c.id AS city_id,
          c.name AS city_name,
          apt.id AS apartment_id,
          apt.name AS apartment_name,
          f.id AS flat_id,
          f.name AS flat_name,
          r.id AS room_id,
          r.name AS room_name,
          b.id AS bed_id,
          b.name AS bed_name
        FROM cities c
        JOIN apartments apt ON apt.city_id = c.id
        JOIN flats f ON f.apartment_id = apt.id
        JOIN rooms r ON r.flat_id = f.id
        JOIN beds b ON b.room_id = r.id
      )
      
      SELECT 
        acc.city_id,
        acc.city_name,
        acc.apartment_id,
        acc.apartment_name,
        acc.flat_id,
        acc.flat_name,
        acc.room_id,
        acc.room_name,
        acc.bed_id,
        acc.bed_name,
        aa.assignment_level,
        aa.check_in,
        aa.check_out,
        aa.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        u.gender AS user_gender,
        CASE 
          WHEN aa.id IS NOT NULL THEN 'occupied'
          ELSE 'vacant'
        END AS status
      FROM all_accommodations acc
      LEFT JOIN active_assignments aa ON (
        (aa.assignment_level = 'bed' AND aa.bed_id = acc.bed_id) OR
        (aa.assignment_level = 'room' AND aa.room_id = acc.room_id) OR
        (aa.assignment_level = 'flat' AND aa.flat_id = acc.flat_id) OR
        (aa.assignment_level = 'apartment' AND aa.apartment_id = acc.apartment_id) OR
        (aa.assignment_level = 'city' AND aa.city_id = acc.city_id)
      )
      LEFT JOIN users u ON u.id = aa.user_id
    `;

    const params = [checkIn, checkOut];
    let whereClauses = [];
    let paramIndex = 3;

    // Add filters - use city name for display but ID for filtering
    if (city) {
      whereClauses.push(`acc.city_id = $${paramIndex++}`);
      params.push(city);
    }

    if (apartment) {
      whereClauses.push(`acc.apartment_id = $${paramIndex++}`);
      params.push(apartment);
    }

    if (status === 'occupied') {
      whereClauses.push(`aa.id IS NOT NULL`);
    } else if (status === 'vacant') {
      whereClauses.push(`aa.id IS NULL`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY acc.city_name, acc.apartment_name, acc.flat_name, acc.room_name, acc.bed_name`;

    const result = await client.query(query, params);

    // Get city name for filter display if city ID is provided
    let cityNameForDisplay = 'All Cities';
    if (city) {
      const cityResult = await client.query('SELECT name FROM cities WHERE id = $1', [city]);
      if (cityResult.rows.length > 0) {
        cityNameForDisplay = cityResult.rows[0].name;
      }
    }

    // Get apartment name for filter display if apartment ID is provided
    let apartmentNameForDisplay = 'All Apartments';
    if (apartment) {
      const apartmentResult = await client.query('SELECT name FROM apartments WHERE id = $1', [apartment]);
      if (apartmentResult.rows.length > 0) {
        apartmentNameForDisplay = apartmentResult.rows[0].name;
      }
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Occupancy Report');

    // Add filter information at the top - using the exact parsed times
    worksheet.addRow(['Occupancy Report - Filter Details']);
    worksheet.addRow(['Generated On', new Date().toLocaleString()]);
    worksheet.addRow(['Check-in Date', formatDateFromParsed(checkInDate)]);
    worksheet.addRow(['Check-out Date', formatDateFromParsed(checkOutDate)]);
    worksheet.addRow(['City Filter', cityNameForDisplay]);
    worksheet.addRow(['Apartment Filter', apartmentNameForDisplay]);
    worksheet.addRow(['Status Filter', status || 'All Statuses']);
    worksheet.addRow([]); // Empty row for spacing

    // Add headers
    const headers = [
      'City', 'Apartment', 'Flat', 'Room', 'Bed',
      'Status', 'Occupied By', 'User Email', 'User Role', 'User Gender',
      'Check-in', 'Check-out', 'Assignment Level'
    ];
    
    worksheet.addRow(headers);

    // Style the headers
    const headerRow = worksheet.getRow(9);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows - use formatted dates for display
    result.rows.forEach(row => {
      worksheet.addRow([
        row.city_name,
        row.apartment_name,
        row.flat_name,
        row.room_name,
        row.bed_name,
        row.status,
        row.user_name || 'N/A',
        row.user_email || 'N/A',
        row.user_role || 'N/A',
        row.user_gender || 'N/A',
        row.check_in ? formatDateForDisplay(row.check_in) : 'N/A',
        row.check_out ? formatDateForDisplay(row.check_out) : 'N/A',
        row.assignment_level || 'N/A'
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 30);
    });

    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=occupancy-report-${Date.now()}.xlsx`);

    // Write Excel to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error exporting occupancy to Excel:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export occupancy data to Excel",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

function parseExactTime(isoString) {
  if (!isoString) return null;
  
  // Extract date and time parts from ISO string
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/);
  if (!match) return new Date(isoString);
  
  const [, year, month, day, hours, minutes, seconds] = match;
  
  // Create date object with exact time (UTC but we're just using the values)
  return {
    year: parseInt(year),
    month: parseInt(month) - 1, // 0-indexed
    day: parseInt(day),
    hours: parseInt(hours),
    minutes: parseInt(minutes),
    seconds: parseInt(seconds)
  };
}

function formatDateFromParsed(timeObj) {
  if (!timeObj) return 'N/A';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[timeObj.month];
  const day = timeObj.day;
  const year = timeObj.year;
  
  // Format time: 9:00 AM (12-hour format)
  let hours = timeObj.hours;
  const minutes = String(timeObj.minutes).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}

function formatDateForDisplay(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  
  // Format: Aug 25, 2025 9:00 AM
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getUTCMonth()]; // Use UTC methods to avoid timezone conversion
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  
  // Format time: 9:00 AM (12-hour format) using UTC hours
  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}




