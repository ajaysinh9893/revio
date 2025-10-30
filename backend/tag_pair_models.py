# Tag Pair Models - QR & NFC Tag Pairing System

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from enum import Enum

class TagPairStatus(str, Enum):
    UNASSIGNED = "unassigned"  # Pair created but not assigned to business
    ASSIGNED = "assigned"      # Assigned to business
    ACTIVE = "active"          # In use by business
    INACTIVE = "inactive"      # Deactivated but can be reactivated
    DELETED = "deleted"        # Soft deleted

class TagPair(BaseModel):
    """QR & NFC Tag Pair Model"""
    model_config = ConfigDict(extra="ignore")
    
    pair_id: str = Field(default_factory=lambda: f"PAIR-{uuid.uuid4().hex[:8].upper()}")
    qr_id: str  # QR code ID
    nfc_id: str  # NFC tag ID
    status: TagPairStatus = TagPairStatus.UNASSIGNED
    
    # Business linkage
    business_id: Optional[str] = None
    business_name: Optional[str] = None
    business_location: Optional[str] = None  # City, Address
    
    # Assignment tracking
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None  # Admin email
    activated_at: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None
    
    # Metadata
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TagPairCreate(BaseModel):
    """Request model for creating tag pairs"""
    qr_id: str
    nfc_id: str
    notes: Optional[str] = None

class TagPairBulkCreate(BaseModel):
    """Request model for bulk creating tag pairs"""
    pairs: list[dict]  # [{"qr_id": "QR-001", "nfc_id": "NFC-001"}, ...]

class TagPairAssign(BaseModel):
    """Request model for assigning tag pair to business"""
    pair_id: str
    business_id: str
    business_location: Optional[str] = None

class TagPairUpdate(BaseModel):
    """Request model for updating tag pair"""
    pair_id: str
    status: Optional[TagPairStatus] = None
    business_location: Optional[str] = None
    notes: Optional[str] = None

class TagPairActivityLog(BaseModel):
    """Activity log for tag pair actions"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pair_id: str
    action: str  # Assign, Reassign, Activate, Deactivate, Delete
    performed_by: str  # Admin email
    previous_state: Optional[dict] = None
    new_state: Optional[dict] = None
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
