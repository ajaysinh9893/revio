# Admin Service - Business Logic for Admin Panel
# Handles all admin operations with proper validation and error handling

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import hashlib
import secrets
from admin_models import (
    Admin, AdminSession, Tag, TagStatus, TagType, Notification,
    NotificationType, DashboardStats, BusinessStatus, AuditLog
)

logger = logging.getLogger(__name__)

class AdminService:
    """Service class for admin operations"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
    
    async def create_admin_session(self, admin_id: str) -> str:
        """Create admin session token"""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        session = AdminSession(
            admin_id=admin_id,
            token=token,
            expires_at=expires_at
        )
        
        session_doc = session.model_dump()
        session_doc['expires_at'] = session_doc['expires_at'].isoformat()
        session_doc['created_at'] = session_doc['created_at'].isoformat()
        
        await self.db.admin_sessions.insert_one(session_doc)
        return token
    
    async def verify_admin_token(self, token: str) -> Optional[Admin]:
        """Verify admin session token"""
        session = await self.db.admin_sessions.find_one(
            {"token": token},
            {"_id": 0}
        )
        
        if not session:
            return None
        
        # Check expiry
        if isinstance(session.get('expires_at'), str):
            expires_at = datetime.fromisoformat(session['expires_at'])
        else:
            expires_at = session['expires_at']
        
        if expires_at <= datetime.now(timezone.utc):
            return None
        
        # Get admin
        admin = await self.db.admins.find_one(
            {"id": session['admin_id'], "active": True},
            {"_id": 0}
        )
        
        if not admin:
            return None
        
        return Admin(**admin)
    
    async def get_dashboard_stats(self) -> DashboardStats:
        """Calculate dashboard statistics"""
        # Total businesses
        total_businesses = await self.db.businesses.count_documents({})
        
        # Active subscriptions
        now = datetime.now(timezone.utc).isoformat()
        active_subscriptions = await self.db.subscriptions.count_documents({
            "status": "active",
            "expiry_date": {"$gt": now}
        })
        
        # Tags
        total_tags = await self.db.tags.count_documents({})
        available_tags = await self.db.tags.count_documents({"status": TagStatus.INACTIVE})
        assigned_tags = await self.db.tags.count_documents({"status": {"$in": [TagStatus.PENDING, TagStatus.ACTIVE]}})
        
        # GPT usage (count reviews generated)
        gpt_usage = await self.db.reviews.count_documents({})
        # Estimate cost: ~$0.0002 per review
        gpt_cost = gpt_usage * 0.0002
        
        # Revenue
        payments = await self.db.payments.find(
            {"status": "completed"},
            {"_id": 0, "amount": 1, "completed_at": 1}
        ).to_list(10000)
        
        total_revenue = sum(p['amount'] for p in payments)
        
        # Monthly revenue
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        monthly_payments = [p for p in payments if p.get('completed_at', '') > month_ago]
        monthly_revenue = sum(p['amount'] for p in monthly_payments)
        
        # Pending payments
        pending_payments = await self.db.payments.count_documents({"status": "pending"})
        
        return DashboardStats(
            total_businesses=total_businesses,
            active_subscriptions=active_subscriptions,
            total_tags=total_tags,
            available_tags=available_tags,
            assigned_tags=assigned_tags,
            gpt_usage_count=gpt_usage,
            gpt_cost=round(gpt_cost, 2),
            total_revenue=round(total_revenue, 2),
            monthly_revenue=round(monthly_revenue, 2),
            pending_payments=pending_payments
        )
    
    async def get_notifications(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get system notifications"""
        notifications = await self.db.notifications.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return notifications
    
    async def create_notification(self, notification: Notification):
        """Create system notification"""
        notif_doc = notification.model_dump()
        notif_doc['created_at'] = notif_doc['created_at'].isoformat()
        await self.db.notifications.insert_one(notif_doc)
    
    async def check_expiring_tags(self) -> List[Dict[str, Any]]:
        """Check for tags expiring in 7 days"""
        now = datetime.now(timezone.utc)
        seven_days = (now + timedelta(days=7)).isoformat()
        
        expiring_tags = await self.db.tags.find({
            "status": TagStatus.ACTIVE,
            "expires_at": {
                "$gte": now.isoformat(),
                "$lte": seven_days
            }
        }, {"_id": 0}).to_list(100)
        
        return expiring_tags
    
    async def check_low_stock(self, threshold: int = 10) -> int:
        """Check if tag inventory is low"""
        available = await self.db.tags.count_documents({"status": TagStatus.INACTIVE})
        return available
    
    async def log_admin_action(self, admin: Admin, action: str, entity_type: str, entity_id: str, changes: dict, ip_address: Optional[str] = None):
        """Log admin action for audit trail"""
        log = AuditLog(
            admin_id=admin.id,
            admin_email=admin.email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes,
            ip_address=ip_address
        )
        
        log_doc = log.model_dump()
        log_doc['created_at'] = log_doc['created_at'].isoformat()
        await self.db.audit_logs.insert_one(log_doc)
        
        logger.info(f"Admin action logged: {admin.email} - {action} - {entity_type}:{entity_id}")
    
    async def get_business_analytics(self, business_id: str) -> Dict[str, Any]:
        """Get analytics for a specific business"""
        # Reviews count
        reviews_count = await self.db.reviews.count_documents({"business_id": business_id})
        
        # Tags assigned
        tags = await self.db.tags.find(
            {"business_id": business_id},
            {"_id": 0}
        ).to_list(100)
        
        active_tags = len([t for t in tags if t['status'] == TagStatus.ACTIVE])
        
        # Subscription info
        subscription = await self.db.subscriptions.find_one(
            {"business_id": business_id},
            {"_id": 0},
            sort=[("expiry_date", -1)]
        )
        
        # Payment history
        payments = await self.db.payments.find(
            {"business_id": business_id, "status": "completed"},
            {"_id": 0}
        ).to_list(50)
        
        total_paid = sum(p['amount'] for p in payments)
        
        return {
            "reviews_count": reviews_count,
            "gpt_usage_count": reviews_count,
            "gpt_cost": round(reviews_count * 0.0002, 2),
            "total_tags": len(tags),
            "active_tags": active_tags,
            "subscription": subscription,
            "payments_count": len(payments),
            "total_paid": round(total_paid, 2)
        }
