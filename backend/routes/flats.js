// routes/flats.js
import express from 'express';
import { createFlat,getFlatByName,editFlat,deleteFlat,getFlatsByApartment,getFlatById } from '../controllers/flatsController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Flats
 *   description: Flat management APIs
 */

/**
 * @swagger
 * /api/flats:
 *   post:
 *     summary: Create a new flat
 *     tags: [Flats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Flat A"
 *               apartment_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Flat created successfully
 */
router.post('/', createFlat);

/**
 * @swagger
 * /api/flats/{id}:
 *   put:
 *     summary: Edit flat details
 *     tags: [Flats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Flat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Flat B"
 *     responses:
 *       200:
 *         description: Flat updated successfully
 *       404:
 *         description: Flat not found
 */
router.put('/:id', editFlat);

/**
 * @swagger
 * /api/flats/{id}:
 *   delete:
 *     summary: Delete a flat
 *     tags: [Flats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Flat ID
 *     responses:
 *       200:
 *         description: Flat deleted successfully
 *       404:
 *         description: Flat not found
 */
router.delete('/:id', deleteFlat);

/**
 * @swagger
 * /api/flats/apartment/{apartmentId}:
 *   get:
 *     summary: Get all flats by apartment ID
 *     tags: [Flats]
 *     parameters:
 *       - in: path
 *         name: apartmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Apartment ID
 *     responses:
 *       200:
 *         description: List of flats for the given apartment
 */
router.get('/apartment/:apartmentId', getFlatsByApartment);

/**
 * @swagger
 * /api/flats/{id}:
 *   get:
 *     summary: Get flat by ID
 *     tags: [Flats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Flat ID
 *     responses:
 *       200:
 *         description: Flat details
 *       404:
 *         description: Flat not found
 */
router.get('/:id', getFlatById);


// router.post('/', createFlat);
// router.put('/:id',editFlat)
// router.delete('/:id',deleteFlat)
// router.get('/apartment/:apartmentId', getFlatsByApartment);
// router.get('/:id', getFlatById);

// router.get('/name/:flatName', getFlatByName);

export default router;
