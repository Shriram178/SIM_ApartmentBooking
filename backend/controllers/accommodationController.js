import pool from '../db.js';
import ExcelJS from 'exceljs';

export const createAccommodationHierarchy = async (req, res) => {
  const client = await pool.connect();

  try {
    const { 
      cityData, 
      apartmentData, 
      flatData, 
      roomData  // array of rooms, each with bedCount
    } = req.body;

    await client.query("BEGIN");

    let cityId, apartmentId, flatId;
    const createdRooms = [];
    const createdBeds = [];

    // 1. Create City (if provided)
    if (cityData) {
      const cityRes = await client.query(
        `INSERT INTO cities (name) 
         VALUES ($1) 
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cityData.name]
      );
      cityId = cityRes.rows[0].id;
    }

    // 2. Create Apartment (if provided, requires cityId)
    if (apartmentData) {
      if (!cityId && !apartmentData.city_id) {
        throw new Error("City ID is required to create apartment");
      }
      
      const apartmentRes = await client.query(
        `INSERT INTO apartments (name, city_id, google_map_link) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [apartmentData.name, apartmentData.city_id || cityId, apartmentData.google_map_link]
      );
      apartmentId = apartmentRes.rows[0].id;
    }

    // 3. Create Flat (if provided, requires apartmentId)
    if (flatData) {
      if (!apartmentId && !flatData.apartment_id) {
        throw new Error("Apartment ID is required to create flat");
      }
      
      const flatRes = await client.query(
        `INSERT INTO flats (name, apartment_id) 
         VALUES ($1, $2) 
         RETURNING id`,
        [flatData.name, flatData.apartment_id || apartmentId]
      );
      flatId = flatRes.rows[0].id;
    }

    // 4. Create Rooms (if provided, requires flatId) and their Beds
    if (roomData && Array.isArray(roomData)) {
      if (roomData.length === 0) {
        throw new Error("At least one room is required");
      }

      if (!flatId && !roomData[0].flat_id) {
        throw new Error("Flat ID is required to create rooms");
      }

      for (const room of roomData) {
        if (!room.bedCount || room.bedCount < 1) {
          throw new Error(`bedCount is required and must be at least 1 for room: ${room.name}`);
        }

        if (!room.name) {
          throw new Error("Room name is required");
        }
        
        // Create room
        const roomRes = await client.query(
          `INSERT INTO rooms (name, flat_id) 
           VALUES ($1, $2) 
           RETURNING id, name, flat_id`,
          [room.name, room.flat_id || flatId]
        );
        
        const roomId = roomRes.rows[0].id;
        const roomBeds = [];

        // Create beds for the room
        for (let i = 1; i <= room.bedCount; i++) {
          const bedName = `Bed ${i}`;
          const bedRes = await client.query(
            `INSERT INTO beds (name, room_id) 
             VALUES ($1, $2) 
             RETURNING id, name, room_id`,
            [bedName, roomId]
          );
          roomBeds.push(bedRes.rows[0]);
          createdBeds.push(bedRes.rows[0]);
        }

        createdRooms.push({
          id: roomId,
          name: room.name,
          flat_id: room.flat_id || flatId,
          bedCount: room.bedCount,
          beds: roomBeds
        });
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Accommodation hierarchy created successfully",
      data: {
        cityId: cityId || null,
        apartmentId: apartmentId || null,
        flatId: flatId || null,
        rooms: createdRooms,
        totalBeds: createdBeds.length
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create accommodation error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Failed to create accommodation hierarchy" 
    });
  } finally {
    client.release();
  }
};

export const exportAccommodationToExcel = async (req, res) => {
  const { city, apartment, flat, room, bed } = req.query;
  const client = await pool.connect();

  try {
    // Simplified query without the statistics
    let query = `
      SELECT 
        c.id AS city_id,
        c.name AS city_name,
        apt.id AS apartment_id,
        apt.name AS apartment_name,
        apt.google_map_link AS apartment_map_link,
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
    `;

    const params = [];
    let whereClauses = [];
    let paramIndex = 1;

    // Add filters
    if (city) {
      whereClauses.push(`c.id = $${paramIndex++}`);
      params.push(city);
    }

    if (apartment) {
      whereClauses.push(`apt.id = $${paramIndex++}`);
      params.push(apartment);
    }

    if (flat) {
      whereClauses.push(`f.id = $${paramIndex++}`);
      params.push(flat);
    }

    if (room) {
      whereClauses.push(`r.id = $${paramIndex++}`);
      params.push(room);
    }

    if (bed) {
      whereClauses.push(`b.id = $${paramIndex++}`);
      params.push(bed);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY c.name, apt.name, f.name, r.name, b.name`;

    const result = await client.query(query, params);
    await generateExcelResponse(res, result.rows, params, city, apartment, flat, room, bed);

  } catch (error) {
    console.error("Error exporting accommodation details to Excel:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export accommodation data to Excel",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

async function generateExcelResponse(res, rows, params, city, apartment, flat, room, bed) {
  // Get filter names for display
  let cityNameForDisplay = 'All Cities';
  let apartmentNameForDisplay = 'All Apartments';
  let flatNameForDisplay = 'All Flats';
  let roomNameForDisplay = 'All Rooms';
  let bedNameForDisplay = 'All Beds';

  const client = await pool.connect();
  try {
    if (city) {
      const cityResult = await client.query('SELECT name FROM cities WHERE id = $1', [city]);
      if (cityResult.rows.length > 0) {
        cityNameForDisplay = cityResult.rows[0].name;
      }
    }

    if (apartment) {
      const apartmentResult = await client.query('SELECT name FROM apartments WHERE id = $1', [apartment]);
      if (apartmentResult.rows.length > 0) {
        apartmentNameForDisplay = apartmentResult.rows[0].name;
      }
    }

    if (flat) {
      const flatResult = await client.query('SELECT name FROM flats WHERE id = $1', [flat]);
      if (flatResult.rows.length > 0) {
        flatNameForDisplay = flatResult.rows[0].name;
      }
    }

    if (room) {
      const roomResult = await client.query('SELECT name FROM rooms WHERE id = $1', [room]);
      if (roomResult.rows.length > 0) {
        roomNameForDisplay = roomResult.rows[0].name;
      }
    }

    if (bed) {
      const bedResult = await client.query('SELECT name FROM beds WHERE id = $1', [bed]);
      if (bedResult.rows.length > 0) {
        bedNameForDisplay = bedResult.rows[0].name;
      }
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Accommodation Details');

    // Add filter information at the top
    worksheet.addRow(['Accommodation Details Report']);
    worksheet.addRow(['Generated On', new Date().toLocaleString()]);
    worksheet.addRow(['City Filter', cityNameForDisplay]);
    worksheet.addRow(['Apartment Filter', apartmentNameForDisplay]);
    worksheet.addRow(['Flat Filter', flatNameForDisplay]);
    worksheet.addRow(['Room Filter', roomNameForDisplay]);
    worksheet.addRow(['Bed Filter', bedNameForDisplay]);
    worksheet.addRow(['Total Records', rows.length]);
    worksheet.addRow([]); // Empty row for spacing

    // Add headers (removed the total beds columns)
    const headers = [
      'City', 
      'Apartment', 
      'Google Map Link',
      'Flat', 
      'Room', 
      'Bed'
    ];
    
    worksheet.addRow(headers);

    // Style the headers
    const headerRow = worksheet.getRow(12);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows (without the total beds data)
    rows.forEach(row => {
      worksheet.addRow([
        row.city_name,
        row.apartment_name,
        row.apartment_map_link || 'N/A',
        row.flat_name,
        row.room_name,
        row.bed_name
      ]);
    });

    // Add summary section
    const summaryRow = worksheet.rowCount + 2;
    worksheet.addRow([]);
    worksheet.addRow(['Summary Statistics']);
    
    // Calculate unique counts
    const uniqueCities = new Set(rows.map(row => row.city_id)).size;
    const uniqueApartments = new Set(rows.map(row => row.apartment_id)).size;
    const uniqueFlats = new Set(rows.map(row => row.flat_id)).size;
    const uniqueRooms = new Set(rows.map(row => row.room_id)).size;
    const uniqueBeds = new Set(rows.map(row => row.bed_id)).size;

    worksheet.addRow(['Total Cities', uniqueCities]);
    worksheet.addRow(['Total Apartments', uniqueApartments]);
    worksheet.addRow(['Total Flats', uniqueFlats]);
    worksheet.addRow(['Total Rooms', uniqueRooms]);
    worksheet.addRow(['Total Beds', uniqueBeds]);

    // Style summary section
    for (let i = summaryRow; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      if (i === summaryRow) {
        row.font = { bold: true, size: 14 };
      } else {
        row.font = { bold: true };
      }
    }

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
    res.setHeader('Content-Disposition', `attachment; filename=accommodation-details-${Date.now()}.xlsx`);

    // Write Excel to response
    await workbook.xlsx.write(res);
    res.end();

  } finally {
    client.release();
  }
}