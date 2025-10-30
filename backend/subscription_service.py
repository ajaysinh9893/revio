# Subscription Service - Core Business Logic
# Handles subscription creation, renewal, expiry checks, and coupon application

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from subscription_models import (
    Subscription, SubscriptionStatus, PlanType, Currency,
    Payment, PaymentStatus, Coupon, CouponUsage, PRICING
)

logger = logging.getLogger(__name__)

class SubscriptionService:
    """Service class for subscription management with security checks"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
    
    async def check_subscription_active(self, business_id: str) -> bool:
        """
        CRITICAL: Check if business has active subscription
        This is called before granting access to any protected feature
        
        Returns:
            True if subscription is active and not expired
            False otherwise
        """
        subscription = await self.db.subscriptions.find_one(
            {"business_id": business_id},
            {"_id": 0},
            sort=[("expiry_date", -1)]  # Get most recent
        )
        
        if not subscription:
            return False
        
        # Parse dates if they're strings
        if isinstance(subscription.get('expiry_date'), str):
            subscription['expiry_date'] = datetime.fromisoformat(subscription['expiry_date'])
        
        now = datetime.now(timezone.utc)
        
        # Check if subscription is active and not expired
        is_active = (
            subscription['status'] == SubscriptionStatus.ACTIVE and
            subscription['expiry_date'] > now
        )
        
        # If expired but status is still active, update it
        if subscription['status'] == SubscriptionStatus.ACTIVE and subscription['expiry_date'] <= now:
            await self.db.subscriptions.update_one(
                {"id": subscription['id']},
                {"$set": {
                    "status": SubscriptionStatus.EXPIRED,
                    "updated_at": now.isoformat()
                }}
            )
            return False
        
        return is_active
    
    async def get_subscription_details(self, business_id: str) -> Optional[Dict[str, Any]]:
        """Get current subscription details for a business"""
        subscription = await self.db.subscriptions.find_one(
            {"business_id": business_id},
            {"_id": 0},
            sort=[("expiry_date", -1)]
        )
        
        if not subscription:
            return None
        
        # Parse dates
        if isinstance(subscription.get('start_date'), str):
            subscription['start_date'] = datetime.fromisoformat(subscription['start_date'])
        if isinstance(subscription.get('expiry_date'), str):
            subscription['expiry_date'] = datetime.fromisoformat(subscription['expiry_date'])
        
        now = datetime.now(timezone.utc)
        days_remaining = (subscription['expiry_date'] - now).days
        
        return {
            "subscription_id": subscription['id'],
            "plan_type": subscription['plan_type'],
            "currency": subscription['currency'],
            "amount": subscription['amount'],
            "status": subscription['status'],
            "start_date": subscription['start_date'].isoformat(),
            "expiry_date": subscription['expiry_date'].isoformat(),
            "days_remaining": max(0, days_remaining),
            "is_active": await self.check_subscription_active(business_id)
        }
    
    async def calculate_price(self, plan_type: PlanType, currency: Currency, coupon_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculate final price with coupon discount if applicable
        
        Returns:
            Dict with original_price, discount, final_price, coupon_applied
        """
        original_price = PRICING[currency.value][plan_type.value]
        discount = 0
        coupon_applied = None
        
        if coupon_code:
            coupon = await self.db.coupons.find_one(
                {"code": coupon_code.upper(), "active": True},
                {"_id": 0}
            )
            
            if coupon:
                # Parse dates
                if isinstance(coupon.get('valid_from'), str):
                    coupon['valid_from'] = datetime.fromisoformat(coupon['valid_from'])
                if isinstance(coupon.get('valid_until'), str):
                    coupon['valid_until'] = datetime.fromisoformat(coupon['valid_until'])
                
                now = datetime.now(timezone.utc)
                
                # Validate coupon
                if (
                    coupon['valid_from'] <= now <= coupon['valid_until'] and
                    (coupon['usage_limit'] == 0 or coupon['used_count'] < coupon['usage_limit'])
                ):
                    if coupon['discount_type'] == 'percentage':
                        discount = original_price * (coupon['discount_value'] / 100)
                    else:  # fixed
                        discount = coupon['discount_value']
                    
                    coupon_applied = coupon['id']
        
        final_price = max(0, original_price - discount)
        
        return {
            "original_price": original_price,
            "discount": discount,
            "final_price": final_price,
            "coupon_applied": coupon_applied,
            "currency": currency.value
        }
    
    async def create_subscription(self, business_id: str, plan_type: PlanType, currency: Currency, payment_id: str, coupon_code: Optional[str] = None) -> Subscription:
        """
        Create new subscription or extend existing one
        Called after successful payment verification
        """
        pricing = await self.calculate_price(plan_type, currency, coupon_code)
        
        # Calculate subscription duration
        now = datetime.now(timezone.utc)
        if plan_type == PlanType.MONTHLY:
            duration_days = 30
        else:  # YEARLY
            duration_days = 365
        
        # Check if business has existing subscription
        existing_sub = await self.db.subscriptions.find_one(
            {"business_id": business_id},
            {"_id": 0},
            sort=[("expiry_date", -1)]
        )
        
        if existing_sub:
            # Parse existing expiry date
            if isinstance(existing_sub.get('expiry_date'), str):
                existing_expiry = datetime.fromisoformat(existing_sub['expiry_date'])
            else:
                existing_expiry = existing_sub['expiry_date']
            
            # If existing subscription is still active, extend from expiry date
            # Otherwise, start from now
            if existing_expiry > now:
                start_date = existing_expiry
            else:
                start_date = now
        else:
            start_date = now
        
        expiry_date = start_date + timedelta(days=duration_days)
        
        # Create subscription
        subscription = Subscription(
            business_id=business_id,
            plan_type=plan_type,
            currency=currency,
            amount=pricing['final_price'],
            start_date=start_date,
            expiry_date=expiry_date,
            status=SubscriptionStatus.ACTIVE,
            trial_used=existing_sub is not None if existing_sub else False
        )
        
        # Save to database
        sub_doc = subscription.model_dump()
        sub_doc['start_date'] = sub_doc['start_date'].isoformat()
        sub_doc['expiry_date'] = sub_doc['expiry_date'].isoformat()
        sub_doc['created_at'] = sub_doc['created_at'].isoformat()
        sub_doc['updated_at'] = sub_doc['updated_at'].isoformat()
        
        await self.db.subscriptions.insert_one(sub_doc)
        
        # Record coupon usage if applied
        if pricing['coupon_applied']:
            coupon_usage = CouponUsage(
                coupon_id=pricing['coupon_applied'],
                business_id=business_id,
                subscription_id=subscription.id,
                discount_amount=pricing['discount']
            )
            usage_doc = coupon_usage.model_dump()
            usage_doc['used_at'] = usage_doc['used_at'].isoformat()
            await self.db.coupon_usage.insert_one(usage_doc)
            
            # Increment coupon usage count
            await self.db.coupons.update_one(
                {"id": pricing['coupon_applied']},
                {"$inc": {"used_count": 1}}
            )
        
        logger.info(f"Subscription created for business {business_id}: {subscription.id}")
        return subscription
    
    async def check_expiring_subscriptions(self) -> List[Dict[str, Any]]:
        """
        Find subscriptions expiring in 7 days that haven't been notified
        This should be run daily via cron job
        
        Returns:
            List of subscriptions that need notification
        """
        now = datetime.now(timezone.utc)
        seven_days_later = now + timedelta(days=7)
        
        # Find active subscriptions expiring in 7 days that haven't been notified
        expiring_subs = await self.db.subscriptions.find({
            "status": SubscriptionStatus.ACTIVE,
            "notified_7days": False,
            "expiry_date": {
                "$gte": now.isoformat(),
                "$lte": seven_days_later.isoformat()
            }
        }, {"_id": 0}).to_list(1000)
        
        return expiring_subs
    
    async def mark_notification_sent(self, subscription_id: str):
        """Mark that 7-day expiry notification has been sent"""
        await self.db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {
                "notified_7days": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
