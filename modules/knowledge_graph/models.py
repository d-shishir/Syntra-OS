import uuid
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.app.database import Base

class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    entity_type = Column(String(50), nullable=False, index=True) # e.g., person, company, invoice, workflow, crm_lead, document, department
    name = Column(String(255), nullable=False, index=True)
    properties = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "entity_type": self.entity_type,
            "name": self.name,
            "properties": self.properties,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    source_id = Column(UUID(as_uuid=True), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id = Column(UUID(as_uuid=True), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(String(100), nullable=False, index=True) # e.g., works_for, submitted, approved_by, processed_by
    properties = Column(JSON, default=dict, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    __table_args__ = (
        UniqueConstraint('source_id', 'target_id', 'relationship_type', name='_source_target_rel_uc'),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "source_id": str(self.source_id),
            "target_id": str(self.target_id),
            "relationship_type": self.relationship_type,
            "properties": self.properties,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
