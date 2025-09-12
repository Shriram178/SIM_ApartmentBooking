// routes/cities.js
import express from 'express';
import { getOccupancy,exportOccupancyToExcel } from '../controllers/occupancyController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Occupancy
 *   description: Occupancy management APIs
 */

/**
 * @swagger
 * /api/occupancy:
 *   post:
 *     summary: Get occupancy data
 *     tags: [Occupancy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkIn:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-25T14:00:00Z"
 *               checkOut:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-30T10:00:00Z"
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: apartment
 *         schema:
 *           type: string
 *         description: Filter by apartment
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by occupancy status
 *     responses:
 *       200:
 *         description: Occupancy data retrieved successfully
 */
router.post('/', getOccupancy);

/**
 * @swagger
 * /api/occupancy/export:
 *   post:
 *     summary: Export occupancy data to Excel
 *     tags: [Occupancy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkIn:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-25T14:00:00Z"
 *               checkOut:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-30T10:00:00Z"
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: apartment
 *         schema:
 *           type: string
 *         description: Filter by apartment
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by occupancy status
 *     responses:
 *       200:
 *         description: Excel file with occupancy data
 */
router.post('/export', exportOccupancyToExcel);


export default router;