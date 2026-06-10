from sqlalchemy import Column, String, LargeBinary, DateTime, func
from app.database import Base

class VaultSecret(Base):
    __tablename__ = "vault_secrets"
    
    connector_key = Column(String(255), primary_key=True, index=True)
    encrypted_value = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
