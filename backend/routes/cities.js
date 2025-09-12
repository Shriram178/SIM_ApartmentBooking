import express from 'express';
import { getAllCities, createCity ,EditCity,deleteCity,getCityById} from '../controllers/citiesController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cities
 *   description: City management APIs
 */

/**
 * @swagger
 * /api/cities:
 *   get:
 *     summary: Get all cities
 *     tags: [Cities]
 *     responses:
 *       200:
 *         description: List of cities
 */
router.get('/', getAllCities);

/**
 * @swagger
 * /api/cities/{id}:
 *   get:
 *     summary: Get city by ID
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: City ID
 *     responses:
 *       200:
 *         description: City details
 *       404:
 *         description: City not found
 */
router.get('/:id', getCityById);

/**
 * @swagger
 * /api/cities:
 *   post:
 *     summary: Create a new city
 *     tags: [Cities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Chennai"
 *     responses:
 *       201:
 *         description: City created successfully
 */
router.post('/', createCity);

/**
 * @swagger
 * /api/cities/{id}:
 *   put:
 *     summary: Edit city details
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: City ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bangalore"
 *     responses:
 *       200:
 *         description: City updated successfully
 *       404:
 *         description: City not found
 */
router.put('/:id', EditCity);

/**
 * @swagger
 * /api/cities/{id}:
 *   delete:
 *     summary: Delete a city
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: City ID
 *     responses:
 *       200:
 *         description: City deleted successfully
 *       404:
 *         description: City not found
 */
router.delete('/:id', deleteCity);


// router.get('/', getAllCities);
// router.get('/:id', getCityById);
// router.post('/', createCity);
// router.put('/:id',EditCity)
// router.delete('/:id',deleteCity)

export default router;
