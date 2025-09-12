-- ENUM TYPES (unchanged)
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected','cancelled','accommodated','completed');
CREATE TYPE booking_type AS ENUM ('individual', 'team');
CREATE TYPE gender_type AS ENUM ('male','female','other');
CREATE TYPE access_level AS ENUM ('user','admin');

-- 1. CITIES
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(100) NOT NULL,
    gender gender_type,
    access access_level DEFAULT 'user'
);

-- 3. APARTMENTS
CREATE TABLE IF NOT EXISTS apartments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city_id INT REFERENCES cities(id) ON DELETE CASCADE,
    google_map_link TEXT
);

-- 4. FLATS
CREATE TABLE IF NOT EXISTS flats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    apartment_id INT REFERENCES apartments(id) ON DELETE CASCADE
);

-- 5. ROOMS
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    flat_id INT REFERENCES flats(id) ON DELETE CASCADE
);

-- 6. BEDS (Cottages)
CREATE TABLE IF NOT EXISTS beds (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE
);

-- 7. BOOKING REQUESTS
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    city_id INT REFERENCES cities(id) ON DELETE CASCADE,
    status request_status DEFAULT 'pending',
    booking_type booking_type DEFAULT 'individual',
    remarks TEXT,
    processed_at TIMESTAMP,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TEAM MEMBERS
CREATE TABLE IF NOT EXISTS booking_members (
    id SERIAL PRIMARY KEY,
    request_id INT REFERENCES requests(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status request_status DEFAULT 'pending'
);

-- 9. ASSIGNED ACCOMMODATIONS
CREATE TABLE IF NOT EXISTS assigned_accommodations (
    id SERIAL PRIMARY KEY,
    booking_members_id INT REFERENCES booking_members(id) ON DELETE CASCADE,
    city_id INT REFERENCES cities(id) ON DELETE SET NULL,
    apartment_id INT REFERENCES apartments(id) ON DELETE SET NULL,
    flat_id INT REFERENCES flats(id) ON DELETE SET NULL,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    bed_id INT REFERENCES beds(id) ON DELETE SET NULL
);

