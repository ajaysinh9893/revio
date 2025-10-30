# Admin Models and Routes
# Comprehensive admin panel for managing Revio platform

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from enum import Enum

# Enums
class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MANAGER = "manager"

class BusinessStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    TRIAL = "trial"

class TagStatus(str, Enum):
    INACTIVE = "inactive"  # Tag created but not assigned
    ACTIVE = "active"      # Tag assigned and in use
    PENDING = "pending"    # Tag assigned but not yet activated
    SCRAPPED = "scrapped"  # Permanently deactivated

class TagType(str, Enum):
    QR = "qr"
    NFC = "nfc"

class NotificationType(str, Enum):
    TAG_EXPIRING = "tag_expiring"
    LOW_STOCK = "low_stock"
    PAYMENT_FAILED = "payment_failed"
    SUBSCRIPTION_EXPIRING = "subscription_expiring"
    SYSTEM_ALERT = "system_alert"
    SUPPORT_TICKET = "support_ticket"

class TicketStatus(str, Enum):
    OPEN = "open"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"

class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

# Admin Models

class Admin(BaseModel):
    """Admin user model"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    name: str
    role: AdminRole = AdminRole.ADMIN
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class AdminSession(BaseModel):
    """Admin session tracking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_id: str
    token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Tag(BaseModel):
    """QR/NFC Tag model"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tag_id: str  # Unique tag identifier (e.g., QR-A1B2C3D4)
    tag_type: TagType  # qr or nfc
    status: TagStatus = TagStatus.INACTIVE
    business_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    location: Optional[str] = None  # e.g., "Table 5", "Counter"
    scrap_reason: Optional[str] = None  # Reason for scrapping
    scrapped_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TagHistory(BaseModel):
    """Tag history tracking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tag_id: str
    action: str  # assigned, activated, unassigned, scrapped, reset
    business_id: Optional[str] = None
    admin_id: str
    admin_email: str
    details: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    """System notification model"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: NotificationType
    title: str
    message: str
    priority: str = "normal"  # low, normal, high, critical
    read: bool = False
    related_id: Optional[str] = None  # Business ID, Tag ID, Ticket ID etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupportTicket(BaseModel):
    """Support ticket model"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    business_name: str
    business_email: str
    subject: str
    description: str
    status: TicketStatus = TicketStatus.OPEN
    priority: TicketPriority = TicketPriority.MEDIUM
    assigned_to: Optional[str] = None  # Admin ID
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_businesses: int
    active_subscriptions: int
    total_tags: int
    available_tags: int
    assigned_tags: int
    gpt_usage_count: int
    gpt_cost: float
    total_revenue: float
    monthly_revenue: float
    pending_payments: int

class BusinessUpdate(BaseModel):
    """Update business details"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    status: Optional[BusinessStatus] = None

class TagAssignment(BaseModel):
    """Assign tag to business"""
    tag_id: str
    business_id: str
    location: Optional[str] = None
    expires_in_days: int = 365

class PromoCode(BaseModel):
    """Promotional code model"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_type: str  # percentage, fixed
    discount_value: float
    max_uses: int = 0  # 0 = unlimited
    used_count: int = 0
    valid_from: datetime
    valid_until: datetime
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentGateway(BaseModel):
    """Payment gateway configuration"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Razorpay India", "Razorpay Canada"
    gateway_type: str  # razorpay, stripe, etc.
    country: str  # IN, CA, US, etc.
    currency: str  # INR, CAD, USD
    key_id: str
    key_secret: str  # encrypted
    active: bool = True
    test_mode: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(BaseModel):
    """Audit trail for admin actions"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_id: str
    admin_email: str
    action: str  # e.g., "business_created", "tag_assigned", "payment_updated"
    entity_type: str  # business, tag, payment, etc.
    entity_id: str
    changes: dict  # Before/after data
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request Models

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TagCreateRequest(BaseModel):
    tag_type: TagType
    tag_id: Optional[str] = None  # Optional, will auto-generate if not provided
    quantity: int = 1  # For bulk creation

class TagBulkUpload(BaseModel):
    """Bulk upload tags"""
    tag_type: TagType
    tag_ids: List[str]  # List of tag IDs to upload

class TagUnassign(BaseModel):
    """Unassign tag from business"""
    tag_id: str

class TagScrap(BaseModel):
    """Scrap a tag"""
    tag_id: str
    reason: str

class TagReset(BaseModel):
    """Reset a tag"""
    tag_id: str

class TicketCreate(BaseModel):
    """Create support ticket"""
    business_id: str
    subject: str
    description: str
    priority: Optional[TicketPriority] = TicketPriority.MEDIUM

class TicketUpdate(BaseModel):
    """Update support ticket"""
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to: Optional[str] = None
    admin_notes: Optional[str] = None

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    max_uses: int = 0
    valid_from: datetime
    valid_until: datetime
