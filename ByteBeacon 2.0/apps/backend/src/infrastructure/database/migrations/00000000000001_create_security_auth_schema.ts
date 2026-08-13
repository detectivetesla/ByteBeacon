import { MigrationFile } from '../migrator.js';

export const migration00000000000001: MigrationFile = {
  version: '00000000000001',
  name: 'create_security_auth_schema',
  upSql: `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(30) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        security_domain VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
        mfa_secret VARCHAR(255),
        mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        wallet_balance_pesewas BIGINT NOT NULL DEFAULT 0,
        failed_login_attempts INT NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_security_domain ON users(security_domain);

    CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
        user_agent TEXT,
        ip_address VARCHAR(45),
        device_id VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        environment VARCHAR(20) NOT NULL DEFAULT 'LIVE',
        scopes TEXT[] NOT NULL DEFAULT '{}',
        rate_limit_tier VARCHAR(50) NOT NULL DEFAULT 'TIER_AGENT',
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_agent ON api_keys(agent_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

    CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(100) PRIMARY KEY,
        description TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
        role VARCHAR(50) NOT NULL,
        permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(role, permission_id)
    );

    INSERT INTO permissions (id, description) VALUES
        ('orders.read', 'View order projections and status'),
        ('orders.create', 'Submit new telecom data orders'),
        ('orders.refund', 'Authorize and issue order refunds'),
        ('orders.reconcile', 'Trigger manual order reconciliation with GMPL'),
        ('wallet.read', 'View wallet balance and ledger entries'),
        ('agents.read', 'View agent accounts and metadata'),
        ('agents.suspend', 'Suspend or reinstate agent privileges'),
        ('api_keys.manage', 'Create, rotate and revoke API keys'),
        ('audit.read', 'View security audit logs'),
        ('settings.manage', 'Modify system-level configurations')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO role_permissions (role, permission_id) VALUES
        ('customer', 'orders.read'),
        ('customer', 'orders.create'),
        ('customer', 'wallet.read'),
        ('agent', 'orders.read'),
        ('agent', 'orders.create'),
        ('agent', 'wallet.read'),
        ('agent', 'api_keys.manage'),
        ('admin', 'orders.read'),
        ('admin', 'orders.create'),
        ('admin', 'orders.refund'),
        ('admin', 'orders.reconcile'),
        ('admin', 'wallet.read'),
        ('admin', 'agents.read'),
        ('admin', 'agents.suspend'),
        ('admin', 'api_keys.manage'),
        ('admin', 'audit.read'),
        ('admin', 'settings.manage'),
        ('super_admin', 'orders.read'),
        ('super_admin', 'orders.create'),
        ('super_admin', 'orders.refund'),
        ('super_admin', 'orders.reconcile'),
        ('super_admin', 'wallet.read'),
        ('super_admin', 'agents.read'),
        ('super_admin', 'agents.suspend'),
        ('super_admin', 'api_keys.manage'),
        ('super_admin', 'audit.read'),
        ('super_admin', 'settings.manage')
    ON CONFLICT DO NOTHING;

    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        correlation_id VARCHAR(100) NOT NULL,
        actor_id UUID,
        actor_type VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        metadata JSONB NOT NULL DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        is_used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

    CREATE TABLE IF NOT EXISTS phone_verifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(30) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_phone_verifications_user ON phone_verifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
  `,
};
