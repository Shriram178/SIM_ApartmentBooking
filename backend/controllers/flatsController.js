// controllers/flatsController.js
import pool from '../db.js';

export const createFlat = async (req, res) => {
  const { name, apartment_id } = req.body;

  if (!name || !apartment_id) {
    return res.status(400).json({ success: false, message: "name and apartment_id are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO flats (name, apartment_id) VALUES ($1, $2) RETURNING id, name, apartment_id`,
      [name, apartment_id]
    );

    res.status(201).json({
      success: true,
      flat: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating flat:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const editFlat=async (req, res) => {
  const flatId = req.params.id;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Flat name is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE flats SET name = $1 WHERE id = $2 RETURNING id, name, apartment_id`,
      [name, flatId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Flat not found" });
    }

    res.json({
      success: true,
      flat: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating flat:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const deleteFlat= async (req, res) => {
  const flatId = req.params.id;

  try {
    const result = await pool.query(`DELETE FROM flats WHERE id = $1 RETURNING id`, [flatId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Flat not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flat:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const getFlatsByApartment = async (req, res) => {
  const { apartmentId } = req.params;
  const client = await pool.connect();

  try {
    // Validate apartment ID
    if (!apartmentId || isNaN(apartmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid apartment ID'
      });
    }

    // Check if apartment exists
    const apartmentCheck = await client.query(
      'SELECT id, name, city_id FROM apartments WHERE id = $1',
      [apartmentId]
    );

    if (apartmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Apartment not found'
      });
    }

    const apartment = apartmentCheck.rows[0];

    // Get all flats in the apartment
    const flatsRes = await client.query(`
      SELECT 
        f.id,
        f.name,
        COUNT(DISTINCT r.id) AS room_count,
        COUNT(DISTINCT b.id) AS bed_count,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.flat_id = f.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM flats f
      LEFT JOIN rooms r ON r.flat_id = f.id
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE f.apartment_id = $1
      GROUP BY f.id
      ORDER BY f.name
    `, [apartmentId]);

    // Get city name
    const cityRes = await client.query(
      'SELECT name FROM cities WHERE id = $1',
      [apartment.city_id]
    );

    const response = {
      success: true,
      data: {
        apartment: {
          id: apartment.id,
          name: apartment.name
        },
        city: {
          id: apartment.city_id,
          name: cityRes.rows[0].name
        },
        flats: flatsRes.rows.map(flat => ({
          id: flat.id,
          name: flat.name,
          status: flat.is_booked ? 'booked' : 'available',
          statistics: {
            rooms: parseInt(flat.room_count),
            beds: parseInt(flat.bed_count)
          }
        }))
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching flats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve flats",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const getFlatById = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // Validate flat ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flat ID'
      });
    }

    // Get flat details with apartment and city information
    const flatRes = await client.query(`
      SELECT 
        f.id,
        f.name,
        f.apartment_id,
        a.name AS apartment_name,
        a.city_id,
        c.name AS city_name,
        COUNT(DISTINCT r.id) AS room_count,
        COUNT(DISTINCT b.id) AS bed_count,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.flat_id = f.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM flats f
      JOIN apartments a ON a.id = f.apartment_id
      JOIN cities c ON c.id = a.city_id
      LEFT JOIN rooms r ON r.flat_id = f.id
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE f.id = $1
      GROUP BY f.id, a.id, c.id
    `, [id]);

    if (flatRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flat not found'
      });
    }

    const flat = flatRes.rows[0];

    // Get all rooms in this flat
    const roomsRes = await client.query(`
      SELECT 
        r.id,
        r.name,
        COUNT(b.id) AS bed_count,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.room_id = r.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM rooms r
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.flat_id = $1
      GROUP BY r.id
      ORDER BY r.name
    `, [id]);

    const response = {
      success: true,
      data: {
        id: flat.id,
        name: flat.name,
        status: flat.is_booked ? 'booked' : 'available',
        apartment: {
          id: flat.apartment_id,
          name: flat.apartment_name
        },
        city: {
          id: flat.city_id,
          name: flat.city_name
        },
        statistics: {
          rooms: parseInt(flat.room_count),
          beds: parseInt(flat.bed_count)
        },
        rooms: roomsRes.rows.map(room => ({
          id: room.id,
          name: room.name,
          status: room.is_booked ? 'booked' : 'available',
          bedCount: parseInt(room.bed_count)
        }))
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching flat:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve flat details",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const getFlatByName = async (req, res) => {
  const { flatName } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        f.id AS flat_id,
        f.name AS flat_name,
        f.is_booked AS flat_booked,
        f.role AS flat_blocked_by,
        r.id AS room_id,
        r.name AS room_name,
        r.is_booked AS room_booked,
        r.role AS room_blocked_by,
        c.id AS cottage_id,
        c.name AS cottage_name,
        c.is_booked AS cottage_booked,
        c.role AS cottage_blocked_by,
        c.room_id AS cottage_room_id
      FROM flats f
      LEFT JOIN rooms r ON r.flat_id = f.id
      LEFT JOIN cottages c ON c.room_id = r.id
      WHERE f.name = $1
      ORDER BY r.id, c.id
      `,
      [flatName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    const flat = result.rows[0];

    const response = {
      id: `FLAT_${flat.flat_name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
      doorNumber: flat.flat_name,
      status: flat.flat_booked ? 'booked' : (flat.flat_blocked_by ? 'partial' : 'available'),
      rooms: []
    };

    const roomMap = new Map();

    for (const row of result.rows) {
      if (row.room_id && !roomMap.has(row.room_id)) {
        const roomItem = {
          id: `room${row.room_id}`,
          name: row.room_name,
          status: row.room_booked ? 'booked' : (row.room_blocked_by ? 'partial' : 'available'),
          bookable: true,
          beds: []
        };
        roomMap.set(row.room_id, roomItem);
        response.rooms.push(roomItem);
      }

      if (row.cottage_id) {
        const bedItem = {
          id: `bed${row.cottage_id}`,
          name: row.cottage_name,
          status: row.cottage_booked ? 'booked' : (row.cottage_blocked_by ? 'partial' : 'available'),
          bookable: true
        };
        roomMap.get(row.cottage_room_id)?.beds.push(bedItem);
      }
    }

    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching flat by name:', err);
    res.status(500).json({ error: 'Failed to fetch flat layout' });
  }
};
