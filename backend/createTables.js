import pool from './db.js';
import fs from 'fs';

const sql = fs.readFileSync('./schema.sql', 'utf8'); // Save the above SQL in schema.sql

async function runMigrations() {
  try {
    await pool.query(sql);
    console.log('Tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();
