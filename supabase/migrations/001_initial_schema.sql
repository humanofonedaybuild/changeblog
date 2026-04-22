-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Repos tracked by Changeblog
CREATE TABLE repos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner         TEXT NOT NULL,
  name          TEXT NOT NULL,
  full_name     TEXT GENERATED ALWAYS AS (owner || '/' || name) STORED,
  description   TEXT,
  stars         INT DEFAULT 0,
  language      TEXT,
  github_app_installation_id BIGINT,
  webhook_active BOOLEAN DEFAULT FALSE,
  last_polled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner, name)
);

-- GitHub releases
CREATE TABLE releases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  github_id     BIGINT UNIQUE,
  tag_name      TEXT NOT NULL,
  name          TEXT,
  body          TEXT,
  published_at  TIMESTAMPTZ,
  is_prerelease BOOLEAN DEFAULT FALSE,
  is_draft      BOOLEAN DEFAULT FALSE,
  processed_at  TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_processing_status CHECK (
    processing_status IN ('pending','processing','done','failed','skipped')
  )
);

-- Processed articles (severity >= 3)
CREATE TABLE articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id    UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  repo_id       UUID NOT NULL REFERENCES repos(id),
  title         TEXT NOT NULL,
  one_liner     TEXT NOT NULL,
  what_changed  TEXT NOT NULL,
  what_to_do    TEXT NOT NULL,
  citations     JSONB DEFAULT '[]',
  severity      INT NOT NULL CHECK (severity BETWEEN 0 AND 5),
  categories    TEXT[] DEFAULT '{}',
  quality_score FLOAT,
  is_quarantined BOOLEAN DEFAULT FALSE,
  quarantine_reason TEXT,
  published_at  TIMESTAMPTZ,
  embedding     vector(1536),
  model_version TEXT,
  content_hash  TEXT,
  maintainer_edited BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Short updates (severity 1-2)
CREATE TABLE updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id    UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  repo_id       UUID NOT NULL REFERENCES repos(id),
  one_liner     TEXT NOT NULL,
  severity      INT NOT NULL CHECK (severity BETWEEN 0 AND 5),
  categories    TEXT[] DEFAULT '{}',
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  github_username TEXT,
  github_user_id BIGINT UNIQUE,
  plan          TEXT DEFAULT 'free' CHECK (plan IN ('free', 'subscriber', 'maintainer')),
  paddle_customer_id TEXT,
  timezone      TEXT DEFAULT 'UTC',
  digest_day    TEXT DEFAULT 'monday',
  digest_enabled BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Repo follows
CREATE TABLE follows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id       UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  alert_threshold INT DEFAULT 4,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

-- Weekly digests
CREATE TABLE digests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  article_ids   UUID[] DEFAULT '{}',
  update_ids    UUID[] DEFAULT '{}',
  sent_at       TIMESTAMPTZ,
  open_count    INT DEFAULT 0,
  click_count   INT DEFAULT 0,
  resend_message_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Instant alerts
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id    UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sent_at       TIMESTAMPTZ,
  resend_message_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Maintainer claims
CREATE TABLE maintainer_claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id       UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','expired')),
  verified_at   TIMESTAMPTZ,
  paddle_subscription_id TEXT,
  branding      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

-- Maintainer edits
CREATE TABLE maintainer_edits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID REFERENCES articles(id) ON DELETE CASCADE,
  update_id     UUID REFERENCES updates(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  field         TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Quality events
CREATE TABLE quality_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID REFERENCES articles(id),
  event_type    TEXT NOT NULL,
  source        TEXT,
  user_id       UUID REFERENCES users(id),
  details       JSONB DEFAULT '{}',
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_articles_repo_published ON articles(repo_id, published_at DESC);
CREATE INDEX idx_articles_severity ON articles(severity) WHERE NOT is_quarantined;
CREATE INDEX idx_releases_repo_status ON releases(repo_id, processing_status);
CREATE INDEX idx_follows_user ON follows(user_id);
CREATE INDEX idx_follows_repo ON follows(repo_id);
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintainer_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintainer_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own digests" ON digests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own claims" ON maintainer_claims
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own edits" ON maintainer_edits
  FOR SELECT USING (auth.uid() = user_id);

-- Public read for repos and articles/updates
ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repos are publicly readable" ON repos FOR SELECT USING (true);
CREATE POLICY "Published articles are publicly readable" ON articles
  FOR SELECT USING (published_at IS NOT NULL AND NOT is_quarantined);
CREATE POLICY "Published updates are publicly readable" ON updates
  FOR SELECT USING (published_at IS NOT NULL);
