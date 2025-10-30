# Notification Service - Automated alerts and color-coded notifications

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import uuid

class NotificationService:
    def __init__(self, db):
        self.db = db
    
    async def create_notification(self, type: str, title: str, message: str, 
                                   priority: str = "medium", related_id: str = None,
                                   business_id: str = None, metadata: dict = None):
        """Create a new notification"""
        notification = {
            "id": str(uuid.uuid4()),
            "type": type,  # NEW_BUSINESS, SUBSCRIPTION_EXPIRING, SUBSCRIPTION_EXPIRED, TAG_PENDING, SUPPORT_TICKET
            "title": title,
            "message": message,
            "priority": priority,  # low, medium, high, critical
            "related_id": related_id,
            "business_id": business_id,
            "metadata": metadata or {},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.admin_notifications.insert_one(notification)
        return notification
    
    async def get_unread_count(self) -> int:
        """Get count of unread notifications"""
        count = await self.db.admin_notifications.count_documents({"is_read": False})
        return count
    
    async def get_notifications(self, limit: int = 50, unread_only: bool = False) -> List[Dict]:
        """Get notifications"""
        query = {"is_read": False} if unread_only else {}
        
        notifications = await self.db.admin_notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return notifications
    
    async def mark_as_read(self, notification_ids: List[str]):
        """Mark notifications as read"""
        await self.db.admin_notifications.update_many(
            {"id": {"$in": notification_ids}},
            {"$set": {"is_read": True}}
        )
    
    async def mark_all_as_read(self):
        """Mark all notifications as read"""
        await self.db.admin_notifications.update_many(
            {},
            {"$set": {"is_read": True}}
        )
    
    async def get_notification_badges(self) -> Dict:
        """Get notification badges for admin tabs"""
        now = datetime.now(timezone.utc)
        seven_days_later = now + timedelta(days=7)
        
        # New businesses (last 24 hours)
        yesterday = now - timedelta(days=1)
        new_businesses_count = await self.db.businesses.count_documents({
            "created_at": {"$gte": yesterday.isoformat()}
        })
        
        # Expiring subscriptions (within 7 days)
        expiring_count = await self.db.subscriptions.count_documents({
            "status": "active",
            "expiry_date": {
                "$gte": now.isoformat(),
                "$lte": seven_days_later.isoformat()
            }
        })
        
        # Expired subscriptions
        expired_count = await self.db.subscriptions.count_documents({
            "status": "expired",
            "expiry_date": {"$lt": now.isoformat()}
        })
        
        # Pending tag allocations
        pending_tags_count = await self.db.business_tags.count_documents({
            "status": "pending"
        })
        
        return {
            "new_businesses": new_businesses_count,
            "expiring_subscriptions": expiring_count,
            "expired_subscriptions": expired_count,
            "pending_tags": pending_tags_count,
            "total_alerts": new_businesses_count + expiring_count + expired_count + pending_tags_count
        }
    
    async def get_business_alerts(self) -> List[Dict]:
        """Get all business alerts with status"""
        now = datetime.now(timezone.utc)
        seven_days_later = now + timedelta(days=7)
        yesterday = now - timedelta(days=1)
        
        # Get all businesses
        businesses = await self.db.businesses.find({}, {"_id": 0}).to_list(1000)
        
        alerts = []
        for business in businesses:
            alert = {
                "business_id": business.get("id"),
                "business_name": business.get("name"),
                "alert_type": None,
                "alert_color": None,
                "alert_message": None,
                "created_at": business.get("created_at")
            }
            
            # Check if business is new (created in last 24 hours)
            created_at_str = business.get("created_at")
            if created_at_str:
                try:
                    created_at = datetime.fromisoformat(created_at_str) if isinstance(created_at_str, str) else created_at_str
                    if created_at >= yesterday:
                        alert["alert_type"] = "new"
                        alert["alert_color"] = "blue"
                        alert["alert_message"] = "New business registered"
                        alerts.append(alert)
                        continue
                except:
                    pass
            
            # Check subscription status from business record itself
            subscription_status = business.get("subscription_status")
            subscription_expires_at_str = business.get("subscription_expires_at")
            
            if subscription_expires_at_str:
                try:
                    expiry_date = datetime.fromisoformat(subscription_expires_at_str) if isinstance(subscription_expires_at_str, str) else subscription_expires_at_str
                    
                    if subscription_status == "expired" or expiry_date < now:
                        alert["alert_type"] = "expired"
                        alert["alert_color"] = "red"
                        alert["alert_message"] = "Subscription expired"
                        alerts.append(alert)
                    elif expiry_date <= seven_days_later:
                        alert["alert_type"] = "expiring"
                        alert["alert_color"] = "yellow"
                        days_left = (expiry_date - now).days
                        alert["alert_message"] = f"Expiring in {days_left} days"
                        alerts.append(alert)
                    elif subscription_status == "active":
                        alert["alert_type"] = "active"
                        alert["alert_color"] = "green"
                        alert["alert_message"] = "Active subscription"
                        alerts.append(alert)
                except:
                    pass
        
        return alerts
    
    async def check_and_create_alerts(self):
        """Check for conditions and create notifications (run periodically)"""
        now = datetime.now(timezone.utc)
        seven_days_later = now + timedelta(days=7)
        
        # Check for new businesses (last 24 hours)
        yesterday = now - timedelta(days=1)
        new_businesses = await self.db.businesses.find(
            {"created_at": {"$gte": yesterday.isoformat()}},
            {"_id": 0}
        ).to_list(100)
        
        for business in new_businesses:
            # Check if notification already exists
            existing = await self.db.admin_notifications.find_one({
                "type": "NEW_BUSINESS",
                "business_id": business.get("id")
            })
            
            if not existing:
                await self.create_notification(
                    type="NEW_BUSINESS",
                    title="New Business Registration",
                    message=f"{business.get('name')} has registered",
                    priority="medium",
                    business_id=business.get("id")
                )
        
        # Check for expiring subscriptions
        expiring_subs = await self.db.subscriptions.find(
            {
                "status": "active",
                "expiry_date": {
                    "$gte": now.isoformat(),
                    "$lte": seven_days_later.isoformat()
                }
            },
            {"_id": 0}
        ).to_list(100)
        
        for sub in expiring_subs:
            # Check if notification already exists for today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            existing = await self.db.admin_notifications.find_one({
                "type": "SUBSCRIPTION_EXPIRING",
                "business_id": sub.get("business_id"),
                "created_at": {"$gte": today_start.isoformat()}
            })
            
            if not existing:
                business = await self.db.businesses.find_one(
                    {"id": sub.get("business_id")},
                    {"_id": 0}
                )
                
                if business:
                    expiry_date = datetime.fromisoformat(sub.get("expiry_date"))
                    days_left = (expiry_date - now).days
                    
                    await self.create_notification(
                        type="SUBSCRIPTION_EXPIRING",
                        title="Subscription Expiring Soon",
                        message=f"{business.get('name')}'s subscription expires in {days_left} days",
                        priority="high",
                        business_id=sub.get("business_id"),
                        metadata={"days_left": days_left}
                    )
        
        # Check for expired subscriptions
        expired_subs = await self.db.subscriptions.find(
            {
                "status": "active",
                "expiry_date": {"$lt": now.isoformat()}
            },
            {"_id": 0}
        ).to_list(100)
        
        for sub in expired_subs:
            # Update subscription status
            await self.db.subscriptions.update_one(
                {"id": sub.get("id")},
                {"$set": {"status": "expired"}}
            )
            
            # Check if notification already exists
            existing = await self.db.admin_notifications.find_one({
                "type": "SUBSCRIPTION_EXPIRED",
                "business_id": sub.get("business_id")
            })
            
            if not existing:
                business = await self.db.businesses.find_one(
                    {"id": sub.get("business_id")},
                    {"_id": 0}
                )
                
                if business:
                    await self.create_notification(
                        type="SUBSCRIPTION_EXPIRED",
                        title="Subscription Expired",
                        message=f"{business.get('name')}'s subscription has expired",
                        priority="critical",
                        business_id=sub.get("business_id")
                    )
        
        # Check for pending tag allocations
        pending_tags = await self.db.business_tags.find(
            {"status": "pending"},
            {"_id": 0}
        ).to_list(100)
        
        for tag in pending_tags:
            existing = await self.db.admin_notifications.find_one({
                "type": "TAG_PENDING",
                "related_id": tag.get("id")
            })
            
            if not existing:
                business = await self.db.businesses.find_one(
                    {"id": tag.get("business_id")},
                    {"_id": 0}
                )
                
                if business:
                    await self.create_notification(
                        type="TAG_PENDING",
                        title="Tag Allocation Pending",
                        message=f"{business.get('name')} has pending tag allocation",
                        priority="medium",
                        related_id=tag.get("id"),
                        business_id=tag.get("business_id")
                    )
