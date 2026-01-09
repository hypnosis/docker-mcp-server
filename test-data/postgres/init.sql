-- Test Database Initialization Script
-- This script creates test data for E2E testing

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test users
INSERT INTO users (username, email) VALUES
    ('testuser1', 'test1@example.com'),
    ('testuser2', 'test2@example.com'),
    ('testuser3', 'test3@example.com')
ON CONFLICT (username) DO NOTHING;

-- Insert test posts
INSERT INTO posts (user_id, title, content) VALUES
    (1, 'First Post', 'This is the first test post'),
    (1, 'Second Post', 'This is the second test post'),
    (2, 'User 2 Post', 'Post from user 2'),
    (3, 'User 3 Post', 'Post from user 3')
ON CONFLICT DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO testuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO testuser;

-- Create a test function for stored procedure testing
CREATE OR REPLACE FUNCTION count_user_posts(user_id_param INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM posts WHERE user_id = user_id_param);
END;
$$ LANGUAGE plpgsql;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Test database initialized successfully!';
    RAISE NOTICE 'Users: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE 'Posts: %', (SELECT COUNT(*) FROM posts);
END $$;
