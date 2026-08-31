"""Contract characterization fields and contacts table

Revision ID: 004
Revises: 003
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("nit", sa.String(30), nullable=True))
    op.add_column("contracts", sa.Column("business_name", sa.String(255), nullable=True))
    op.add_column("contracts", sa.Column("economic_group", sa.String(255), nullable=True))

    op.create_table(
        "contract_contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("position", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_contract_contacts_contract_id", "contract_contacts", ["contract_id"])


def downgrade() -> None:
    op.drop_index("ix_contract_contacts_contract_id", table_name="contract_contacts")
    op.drop_table("contract_contacts")
    op.drop_column("contracts", "economic_group")
    op.drop_column("contracts", "business_name")
    op.drop_column("contracts", "nit")
