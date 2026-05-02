const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: 'db',
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: 5432,
});

app.get('/', (req, res) => res.status(200).send('Backend Operational'));

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing arguments' });
    try {
        const client = await pool.connect(); 
        client.release();
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        res.status(500).json({ error: 'DB Connection Error', details: err.message });
    }
});

app.listen(process.env.PORT || 3000);
