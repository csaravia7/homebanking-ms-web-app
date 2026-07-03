const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'homebanking_db'
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('✓ Users table created');

    // Insert demo users
    const hash = '$2a$10$slYQmyNdGzin7olVN3p36OPST9/PgBkqquzi.Ee4waLTjNdAB3kZW';
    await client.query(`
      INSERT INTO users (email, password, first_name, last_name) VALUES 
      ('alice@example.com', $1, 'Alice', 'Johnson'),
      ('bob@example.com', $1, 'Bob', 'Smith')
      ON CONFLICT (email) DO NOTHING;
    `, [hash]);
    console.log('✓ Demo users inserted');

    // Verify
    const result = await client.query('SELECT id, email, first_name FROM users;');
    console.log('✓ Users in database:');
    result.rows.forEach(row => console.log(`  - ${row.email} (${row.first_name})`));
  } catch (err) {
    console.error('✗ Database setup failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
