-- ============================================================
-- Blog Platform Schema (PostgreSQL)
-- Tables: users, posts, comments, tags, post_tags
-- ============================================================

-- ── Users ──
CREATE TABLE users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(50) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    bio         TEXT,
    avatar_url  VARCHAR(500),
    role        VARCHAR(20) DEFAULT 'author' CHECK (role IN ('admin', 'editor', 'author', 'reader')),
    is_verified BOOLEAN DEFAULT FALSE,
    last_login  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Posts ──
CREATE TABLE posts (
    post_id      SERIAL PRIMARY KEY,
    author_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title        VARCHAR(300) NOT NULL,
    slug         VARCHAR(350) NOT NULL UNIQUE,
    excerpt      VARCHAR(500),
    content      TEXT NOT NULL,
    status       VARCHAR(15) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured_img VARCHAR(500),
    view_count   INTEGER DEFAULT 0,
    like_count   INTEGER DEFAULT 0,
    is_featured  BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_author ON posts (author_id);
CREATE INDEX idx_posts_status ON posts (status);
CREATE INDEX idx_posts_slug ON posts (slug);
CREATE INDEX idx_posts_published ON posts (published_at DESC) WHERE status = 'published';

-- ── Comments ──
CREATE TABLE comments (
    comment_id  SERIAL PRIMARY KEY,
    post_id     INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    parent_id   INTEGER REFERENCES comments(comment_id) ON DELETE CASCADE,
    guest_name  VARCHAR(100),
    guest_email VARCHAR(255),
    body        TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_post ON comments (post_id);
CREATE INDEX idx_comments_user ON comments (user_id);
CREATE INDEX idx_comments_parent ON comments (parent_id);

-- ── Tags ──
CREATE TABLE tags (
    tag_id    SERIAL PRIMARY KEY,
    name      VARCHAR(60) NOT NULL UNIQUE,
    slug      VARCHAR(80) NOT NULL UNIQUE,
    color     VARCHAR(7) DEFAULT '#6366f1'
);

-- ── Post–Tag Junction ──
CREATE TABLE post_tags (
    post_id  INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ── Seed Data ──
INSERT INTO users (username, email, display_name, bio, role, is_verified) VALUES
    ('nilesh_p',  'nilesh@blog.com',   'Nilesh Pardeshi', 'Tech lead and database enthusiast',            'admin',  TRUE),
    ('sara_dev',  'sara@blog.com',     'Sara Chen',       'Full-stack developer writing about React',     'author', TRUE),
    ('john_ops',  'john@blog.com',     'John Miller',     'DevOps engineer sharing infrastructure tips',  'author', TRUE),
    ('reader_01', 'reader01@blog.com', 'Alex Reader',     NULL,                                           'reader', FALSE);

INSERT INTO tags (name, slug, color) VALUES
    ('PostgreSQL',  'postgresql',  '#336791'),
    ('TypeScript',  'typescript',  '#3178c6'),
    ('React',       'react',       '#61dafb'),
    ('DevOps',      'devops',      '#e535ab'),
    ('Performance', 'performance', '#f59e0b'),
    ('Tutorial',    'tutorial',    '#10b981');

INSERT INTO posts (author_id, title, slug, excerpt, content, status, view_count, like_count, is_featured, published_at) VALUES
    (1, 'Mastering PostgreSQL Indexes',
        'mastering-postgresql-indexes',
        'A deep dive into B-tree, GIN, GiST and BRIN indexes.',
        'PostgreSQL offers a rich set of index types. In this article we explore when to use each one, with real-world benchmarks and examples...',
        'published', 1520, 84, TRUE, '2025-01-10 09:00:00'),
    (2, 'Building Type-Safe APIs with TypeScript',
        'building-type-safe-apis-typescript',
        'End-to-end type safety from database to frontend.',
        'Type safety reduces bugs dramatically. We will walk through setting up Prisma, tRPC, and Zod for a bulletproof API layer...',
        'published', 980, 62, FALSE, '2025-02-05 14:30:00'),
    (3, 'Docker Compose for Local Development',
        'docker-compose-local-development',
        'Simplify your dev environment with containers.',
        'Gone are the days of "works on my machine". Docker Compose lets your entire team run the same stack locally...',
        'published', 750, 45, FALSE, '2025-02-20 10:00:00'),
    (1, 'Query Optimization Checklist',
        'query-optimization-checklist',
        'Ten things to check before blaming the database.',
        'Before you add more RAM or scale horizontally, make sure you have covered these fundamental query optimizations...',
        'draft', 0, 0, FALSE, NULL);

INSERT INTO post_tags (post_id, tag_id) VALUES
    (1, 1), (1, 5), (1, 6),
    (2, 2), (2, 6),
    (3, 4), (3, 6),
    (4, 1), (4, 5);

INSERT INTO comments (post_id, user_id, body, is_approved) VALUES
    (1, 2, 'Great article! The GIN index section was especially helpful.', TRUE),
    (1, 4, 'Could you cover partial indexes in a follow-up?', TRUE),
    (2, 3, 'We adopted this exact stack last month — highly recommend it.', TRUE),
    (3, 1, 'Nice write-up, John! We should add Traefik examples too.', TRUE);

INSERT INTO comments (post_id, user_id, parent_id, body, is_approved) VALUES
    (1, 1, 2, 'Absolutely, partial indexes post is coming next week!', TRUE);
