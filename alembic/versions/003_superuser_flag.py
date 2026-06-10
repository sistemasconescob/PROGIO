"""Add is_superuser flag and set admin as superuser

Revision ID: 003
Revises: 002
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="false"))
    op.execute("UPDATE users SET is_superuser = true WHERE username = 'admin'")


def downgrade() -> None:
    op.drop_column("users", "is_superuser")
