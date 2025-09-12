// controllers/citiesController.js
import pool from '../db.js';

export const getAllCities = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cities ORDER BY id');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching cities:', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
};

export const createCity = async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ success: false, message: "City name is required." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO cities (name) VALUES ($1) RETURNING id, name",
      [name.trim()]
    );

    res.status(201).json({
      success: true,
      city: result.rows[0]
    });
  } catch (error) {
    console.error("Error inserting city:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const EditCity = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ success: false, message: "City name is required." });
  }

  try {
    const result = await pool.query(
      "UPDATE cities SET name = $1 WHERE id = $2 RETURNING id, name",
      [name.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "City not found." });
    }

    res.json({ success: true, city: result.rows[0] });
  } catch (error) {
    console.error("Error updating city:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const deleteCity=async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM cities WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "City not found." });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting city:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const getCityById = async (req, res) => {
  const { id } = req.params;

  try {
    // Validate city ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid city ID is required'
      });
    }

    const query = `
      SELECT 
        id,
        name
      FROM cities 
      WHERE id = $1
    `;

    const { rows } = await pool.query(query, [parseInt(id)]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    const city = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: city.id,
        name: city.name
      }
    });

  } catch (error) {
    console.error('Error fetching city by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
