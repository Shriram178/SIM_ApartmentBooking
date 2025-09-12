// routes/cities.js
import express from 'express';
import { createBed,editBed,deleteBed  } from '../controllers/bedController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Beds
 *   description: Bed management APIs
 */

/**
 * @swagger
 * /api/beds:
 *   post:
 *     summary: Create a new bed
 *     tags: [Beds]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               room_id:
 *                 type: integer
 *                 description: ID of the room where the bed belongs
 *                 example: 1
 *               name:
 *                 type: string
 *                 description: Bed number or label
 *                 example: "B1"
 *     responses:
 *       201:
 *         description: Bed created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', createBed);

/**
 * @swagger
 * /api/beds/{id}:
 *   put:
 *     summary: Update an existing bed
 *     tags: [Beds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bed ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated bed number or label
 *                 example: "New Name"
 *     responses:
 *       200:
 *         description: Bed updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Bed not found
 */
router.put('/:id', editBed);

/**
 * @swagger
 * /api/beds/{id}:
 *   delete:
 *     summary: Delete a bed
 *     tags: [Beds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bed ID
 *     responses:
 *       200:
 *         description: Bed deleted successfully
 *       404:
 *         description: Bed not found
 */
router.delete('/:id', deleteBed);


// router.post('/', createBed);
// router.put('/:id',editBed);
// router.delete('/:id',deleteBed);

export default router;