import express from 'express';
import { createAccommodationHierarchy ,exportAccommodationToExcel } from '../controllers/accommodationController.js';

const router = express.Router();


/**
 * @swagger
 * tags:
 *   name: Accommodation
 *   description: Accommodation hierarchy management APIs
 */

/**
 * @swagger
 * /api/accommodation:
 *   post:
 *     summary: Create a full accommodation hierarchy (city → apartment → flat → rooms → beds)
 *     tags: [Accommodation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cityData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "New York"
 *               apartmentData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Sky Tower"
 *                   google_map_link:
 *                     type: string
 *                     example: "https://maps.example.com/skytower"
 *               flatData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Floor 5"
 *               roomData:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Room 501"
 *                     bedCount:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: Accommodation hierarchy created successfully
 */
router.post('/', createAccommodationHierarchy);

/**
 * @swagger
 * /api/accommodation/export:
 *   get:
 *     summary: Export accommodation hierarchy to Excel
 *     tags: [Accommodation]
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
 *         name: flat
 *         schema:
 *           type: string
 *         description: Filter by flat
 *       - in: query
 *         name: room
 *         schema:
 *           type: string
 *         description: Filter by room
 *       - in: query
 *         name: bed
 *         schema:
 *           type: string
 *         description: Filter by bed
 *     responses:
 *       200:
 *         description: Excel file with accommodation hierarchy
 */
router.get('/export', exportAccommodationToExcel);


export default router;