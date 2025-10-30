# Subscription System Models and Database Schema
# This file contains Pydantic models for subscription management

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid

# Enums
class SubscriptionStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class PlanType(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"

class Currency(str, Enum):
    CAD = "CAD"
    INR = "INR"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

# Pricing Configuration
PRICING = {
    "CAD": {
        "monthly": 1.99,
        "yearly": 14.99
    },
    "INR": {
        "monthly": 99,
        "yearly": 799
    }
}

# Database Schema Models

class BusinessRegistration(BaseModel):
    """Enhanced business registration with full details"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    address: str
    category: str  # e.g., Restaurant, Cafe, Retail, Services
    google_place_id: str
    owner_email: EmailStr
    qr_code: Optional[str] = None
    verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Subscription(BaseModel):
    """Subscription details with expiry tracking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    plan_type: PlanType
    currency: Currency
    amount: float
    start_date: datetime
    expiry_date: datetime
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    auto_renewal: bool = False
    trial_used: bool = False
    notified_7days: bool = False  # Track if 7-day expiry email sent
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    """Payment transaction record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    subscription_id: Optional[str] = None
    amount: float
    currency: Currency
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    status: PaymentStatus = PaymentStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class Coupon(BaseModel):
    """Discount coupon for subscriptions"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # e.g., LAUNCH50, NEWYEAR2025
    discount_type: str  # "percentage" or "fixed"
    discount_value: float  # 50 for 50% or 100 for ₹100 off
    valid_from: datetime
    valid_until: datetime
    usage_limit: int = 0  # 0 = unlimited
    used_count: int = 0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CouponUsage(BaseModel):
    """Track coupon usage to prevent abuse"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupon_id: str
    business_id: str
    subscription_id: str
    discount_amount: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request/Response Models

class BusinessRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    category: str
    google_place_id: str
    owner_email: EmailStr

class SubscriptionPlanRequest(BaseModel):
    business_id: str
    plan_type: PlanType
    currency: Currency
    coupon_code: Optional[str] = None

class PaymentVerifyRequest(BaseModel):
    business_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_type: PlanType
    currency: Currency

class CouponApplyRequest(BaseModel):
    coupon_code: str
    plan_type: PlanType
    currency: Currency
