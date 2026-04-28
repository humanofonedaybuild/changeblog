-- Add platform discriminator and HF-specific fields to repos
ALTER TABLE repos
  ADD COLUMN platform TEXT NOT NULL DEFAULT 'github'
    CHECK (platform IN ('github', 'hugging_face')),
  ADD COLUMN hf_author TEXT,
  ADD COLUMN hf_pipeline_tag TEXT,
  ADD COLUMN hf_likes INT DEFAULT 0,
  ADD COLUMN hf_downloads INT DEFAULT 0;

-- Update unique constraint to be platform-aware
ALTER TABLE repos DROP CONSTRAINT repos_owner_name_key;
ALTER TABLE repos ADD CONSTRAINT repos_owner_name_platform_key UNIQUE (owner, name, platform);

CREATE INDEX idx_repos_platform ON repos(platform);

-- Add HF-specific fields to releases
ALTER TABLE releases
  ADD COLUMN hf_commit_sha TEXT,
  ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'github'
    CHECK (source_platform IN ('github', 'hugging_face'));

-- Allow multiple rows per repo+hf_commit_sha but ensure uniqueness where sha is set
CREATE UNIQUE INDEX idx_releases_hf_commit ON releases(repo_id, hf_commit_sha)
  WHERE hf_commit_sha IS NOT NULL;

-- Add queued to valid processing statuses (needed for rate limit gate)
ALTER TABLE releases DROP CONSTRAINT valid_processing_status;
ALTER TABLE releases ADD CONSTRAINT valid_processing_status CHECK (
  processing_status IN ('pending','processing','done','failed','skipped','queued')
);
