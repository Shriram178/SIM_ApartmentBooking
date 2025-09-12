
import express from 'express';
import { createRoom,updateRoom,deleteRoom ,getRoomById,getRoomsByFlat} from '../controllers/roomController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room management APIs
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Room A"
 *               flat_id:
 *                 type: integer
 *                 example: 1
 *               beds:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post('/', createRoom);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   patch:
 *     summary: Update room details
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Room A"
 *               beds:
 *                 type: integer
 *                 example: 4
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       404:
 *         description: Room not found
 */
router.patch('/:roomId', updateRoom);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   delete:
 *     summary: Delete a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       404:
 *         description: Room not found
 */
router.delete('/:roomId', deleteRoom);

/**
 * @swagger
 * /api/rooms/flat/{flatId}:
 *   get:
 *     summary: Get all rooms by flat ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: flatId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Flat ID
 *     responses:
 *       200:
 *         description: List of rooms for the given flat
 */
router.get('/flat/:flatId', getRoomsByFlat);

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room details
 *       404:
 *         description: Room not found
 */
router.get('/:id', getRoomById);



export default router;
