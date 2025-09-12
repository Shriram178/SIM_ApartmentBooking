// controllers/apartmentsController.js
import pool from '../db.js';

export const createApartment = async (req, res) => {
  try {
    let { name, cityId, googleMapLink } = req.body;

    console.log("Received cityId:", cityId); // Debug log

    // Ensure cityId is an integer
    cityId = parseInt(cityId);
    if (isNaN(cityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cityId"
      });
    }

    const result = await pool.query(
      'INSERT INTO apartments (name, city_id, google_map_link) VALUES ($1, $2, $3) RETURNING *',
      [name, cityId, googleMapLink]
    );

    res.status(201).json({
      success: true,
      apartment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating apartment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const editApartment=async (req, res) => {
  const apartmentId = req.params.id;
  const { name, googleMapLink } = req.body;

  try {
    const result = await pool.query(
      `UPDATE apartments
       SET name = $1, google_map_link = $2
       WHERE id = $3
       RETURNING id, name, google_map_link`,
      [name, googleMapLink, apartmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Apartment not found" });
    }

    res.json({
      success: true,
      apartment: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating apartment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const getApartmentById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM apartments WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Apartment not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching apartment by ID:', err);
    res.status(500).json({ error: 'Failed to fetch apartment' });
  }
};

export const getAllApartments = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apartments ORDER BY id');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching apartments:', err);
    res.status(500).json({ error: 'Failed to fetch apartments' });
  }
};

export const deleteApartment=async (req, res) => {
  const apartmentId = req.params.id;

  try {
    const result = await pool.query(
      `DELETE FROM apartments WHERE id = $1 RETURNING id`,
      [apartmentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Apartment not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting apartment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const getApartmentsByCity = async (req, res) => {
  const cityId = parseInt(req.params.cityId);
  const client = await pool.connect();

  try {
    // Validate cityId
    if (!cityId || isNaN(cityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city ID'
      });
    }

    // 1. First verify the city exists
    const cityCheck = await client.query(
      'SELECT id, name FROM cities WHERE id = $1',
      [cityId]
    );

    if (cityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    const cityName = cityCheck.rows[0].name;

    // 2. Get all apartments for the city
    const apartmentsRes = await client.query(
      `SELECT 
        a.id,
        a.name,
        a.google_map_link,
        COUNT(DISTINCT f.id) as flat_count,
        COUNT(DISTINCT r.id) as room_count,
        COUNT(DISTINCT b.id) as bed_count
       FROM apartments a
       LEFT JOIN flats f ON f.apartment_id = a.id
       LEFT JOIN rooms r ON r.flat_id = f.id
       LEFT JOIN beds b ON b.room_id = r.id
       WHERE a.city_id = $1
       GROUP BY a.id, a.name, a.google_map_link
       ORDER BY a.name`,
      [cityId]
    );

    // 3. Format response
    const response = {
      success: true,
      data: {
        city: {
          id: cityId,
          name: cityName
        },
        apartments: apartmentsRes.rows.map(apartment => ({
          id: apartment.id,
          name: apartment.name,
          googleMapLink: apartment.google_map_link,
          statistics: {
            flats: parseInt(apartment.flat_count),
            rooms: parseInt(apartment.room_count),
            beds: parseInt(apartment.bed_count)
          }
        }))
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching apartments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve apartments",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};



