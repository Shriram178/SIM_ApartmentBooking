import pool from '../db.js';

export const getRoomById = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // Validate room ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID'
      });
    }

    // Get room details with flat and apartment information
    const roomRes = await client.query(`
      SELECT 
        r.id,
        r.name,
        r.flat_id,
        f.name AS flat_name,
        f.apartment_id,
        a.name AS apartment_name,
        a.city_id,
        c.name AS city_name,
        COUNT(DISTINCT b.id) AS bed_count,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.room_id = r.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM rooms r
      JOIN flats f ON f.id = r.flat_id
      JOIN apartments a ON a.id = f.apartment_id
      JOIN cities c ON c.id = a.city_id
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.id = $1
      GROUP BY r.id, f.id, a.id, c.id
    `, [id]);

    if (roomRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const room = roomRes.rows[0];

    // Get all beds in this room
    const bedsRes = await client.query(`
      SELECT 
        b.id,
        b.name,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.bed_id = b.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM beds b
      WHERE b.room_id = $1
      ORDER BY b.name
    `, [id]);

    const response = {
      success: true,
      data: {
        id: room.id,
        name: room.name,
        status: room.is_booked ? 'booked' : 'available',
        flat: {
          id: room.flat_id,
          name: room.flat_name,
          apartment: {
            id: room.apartment_id,
            name: room.apartment_name,
            city: {
              id: room.city_id,
              name: room.city_name
            }
          }
        },
        statistics: {
          beds: parseInt(room.bed_count)
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching room:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve room details",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const getRoomsByFlat = async (req, res) => {
  const { flatId } = req.params;
  const client = await pool.connect();

  try {
    // Validate flat ID
    if (!flatId || isNaN(flatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flat ID'
      });
    }

    // Check if flat exists
    const flatCheck = await client.query(`
      SELECT 
        f.id,
        f.name,
        f.apartment_id,
        a.name AS apartment_name,
        a.city_id,
        c.name AS city_name
      FROM flats f
      JOIN apartments a ON a.id = f.apartment_id
      JOIN cities c ON c.id = a.city_id
      WHERE f.id = $1
    `, [flatId]);

    if (flatCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flat not found'
      });
    }

    const flat = flatCheck.rows[0];

    // Get all rooms with their beds
    const roomsRes = await client.query(`
      SELECT 
        r.id AS room_id,
        r.name AS room_name,
        b.id AS bed_id,
        b.name AS bed_name,
        EXISTS (
          SELECT 1 FROM assigned_accommodations aa
          JOIN booking_members bm ON bm.id = aa.booking_members_id
          WHERE aa.room_id = r.id
          AND bm.check_out > NOW()
        ) AS is_booked
      FROM rooms r
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.flat_id = $1
      ORDER BY r.name, b.name
    `, [flatId]);

    // Group rooms and beds
    const roomsMap = {};
    roomsRes.rows.forEach(row => {
      if (!roomsMap[row.room_id]) {
        roomsMap[row.room_id] = {
          id: row.room_id,
          name: row.room_name,
          statistics: {
            beds: 0
          },
          beds: []
        };
      }

      if (row.bed_id) {
        roomsMap[row.room_id].beds.push({
          id: row.bed_id,
          name: row.bed_name
        });
        roomsMap[row.room_id].statistics.beds++;
      }
    });

    const response = {
      success: true,
      data: {
        flat: {
          id: flat.id,
          name: flat.name,
          apartment: {
            id: flat.apartment_id,
            name: flat.apartment_name,
            city: {
              id: flat.city_id,
              name: flat.city_name
            }
          }
        },
        rooms: Object.values(roomsMap)
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching rooms:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve rooms",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};


export const createRoom=  async (req, res) => {
  const { name, flat_id, beds } = req.body;

  try {
    // 1. Insert into rooms
    const roomResult = await pool.query(
      'INSERT INTO rooms (name, flat_id) VALUES ($1, $2) RETURNING id',
      [name, flat_id]
    );
    const roomId = roomResult.rows[0].id;

    // 2. Insert 'beds' number of rows into beds table
    const bedInserts = [];
    for (let i = 1; i <= beds; i++) {
      const bedName = `Bed ${i}`;
      bedInserts.push(
        pool.query(
          `INSERT INTO beds (name, room_id) VALUES ($1, $2)`,
          [bedName, roomId]
        )
      );
    }

    await Promise.all(bedInserts);

    // 3. Return response
    res.status(201).json({
      success: true,
      room: {
        id: roomId,
        name,
        flat_id,
        beds
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Error creating room' });
  }
};

export const updateRoom = async (req, res) => {
  const client = await pool.connect();

  try {
    const { roomId } = req.params;
    const { name, beds: targetBedCount } = req.body;

    // Validate input
    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: "Room ID is required"
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "Room name is required"
      });
    }

    if (targetBedCount === undefined || targetBedCount === null || targetBedCount < 1) {
      return res.status(400).json({
        success: false,
        error: "Valid bed count is required (must be at least 1)"
      });
    }

    await client.query("BEGIN");

    // Check if room exists
    const roomCheck = await client.query(
      'SELECT id, name, flat_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Room not found"
      });
    }

    // Get current beds count
    const currentBedsResult = await client.query(
      'SELECT id, name FROM beds WHERE room_id = $1 ORDER BY id',
      [roomId]
    );
    const currentBeds = currentBedsResult.rows;
    const currentBedCount = currentBeds.length;

    // Update room name
    const roomUpdateResult = await client.query(
      `UPDATE rooms 
       SET name = $1 
       WHERE id = $2 
       RETURNING id, name, flat_id`,
      [name.trim(), roomId]
    );

    const updatedRoom = roomUpdateResult.rows[0];
    const bedOperations = [];

    // Handle bed adjustments
    if (targetBedCount > currentBedCount) {
      // Need to add beds
      const bedsToAdd = targetBedCount - currentBedCount;
      for (let i = 1; i <= bedsToAdd; i++) {
        const bedNumber = currentBedCount + i;
        const bedName = `Bed ${bedNumber}`;
        
        const bedResult = await client.query(
          `INSERT INTO beds (name, room_id) 
           VALUES ($1, $2) 
           RETURNING id, name, room_id`,
          [bedName, roomId]
        );
        bedOperations.push({ operation: 'added', bed: bedResult.rows[0] });
      }
    } else if (targetBedCount < currentBedCount) {
      // Need to remove beds
      const bedsToRemove = currentBedCount - targetBedCount;
      const bedsToDelete = currentBeds.slice(-bedsToRemove);
      
      for (const bed of bedsToDelete) {
        await client.query(
          'DELETE FROM beds WHERE id = $1',
          [bed.id]
        );
        bedOperations.push({ operation: 'removed', bed });
      }
    }

    // Get updated beds list
    const updatedBedsResult = await client.query(
      'SELECT id, name FROM beds WHERE room_id = $1 ORDER BY id',
      [roomId]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: {
        room: updatedRoom,
        previousBedCount: currentBedCount,
        newBedCount: targetBedCount,
        bedOperations: bedOperations,
        beds: updatedBedsResult.rows
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update room error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update room" 
    });
  } finally {
    client.release();
  }
};

export const deleteRoom=async (req, res) => {
  const roomId = req.params.id;

  try {

    // Then delete the room
    const result = await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}