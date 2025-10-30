# Payment and Subscription Endpoints
# Integrated with Razorpay for secure payment processing

from fastapi import APIRouter, HTTPException, Depends, Request
from subscription_models import (
    BusinessRegisterRequest, SubscriptionPlanRequest, PaymentVerifyRequest,
    CouponApplyRequest, PlanType, Currency, PRICING, Payment, PaymentStatus
)
from subscription_service import SubscriptionService
import razorpay
import hmac
import hashlib
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)

# Initialize Razorpay client
razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID', '')
razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')

if razorpay_key_id and razorpay_key_secret:
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
else:
    razorpay_client = None

def get_subscription_service(request: Request) -> SubscriptionService:
    """Dependency injection for subscription service"""
    return SubscriptionService(request.app.state.db)

async def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verify Razorpay payment signature to prevent fraud
    CRITICAL: This ensures payment authenticity
    """
    if not razorpay_key_secret:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    # Create signature verification string
    message = f"{order_id}|{payment_id}"
    
    # Generate expected signature
    expected_signature = hmac.new(
        razorpay_key_secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)

# Create router
payment_router = APIRouter(prefix="/api/subscription", tags=["subscription"])

@payment_router.post("/create-order")
async def create_subscription_order(
    request: SubscriptionPlanRequest,
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Step 1: Create Razorpay order for subscription payment
    
    Process:
    1. Validate plan and currency
    2. Apply coupon if provided
    3. Create Razorpay order
    4. Save payment record with PENDING status
    """
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    # Calculate price with coupon
    pricing = await service.calculate_price(
        request.plan_type,
        request.currency,
        request.coupon_code
    )
    
    # Convert to smallest currency unit (paise for INR, cents for CAD)
    amount_in_cents = int(pricing['final_price'] * 100)
    
    try:
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_cents,
            "currency": request.currency.value,
            "payment_capture": 1,
            "notes": {
                "business_id": request.business_id,
                "plan_type": request.plan_type.value,
                "coupon_code": request.coupon_code or "none"
            }
        })
        
        # Create payment record
        payment = Payment(
            business_id=request.business_id,
            amount=pricing['final_price'],
            currency=request.currency,
            razorpay_order_id=razorpay_order['id'],
            status=PaymentStatus.PENDING
        )
        
        # Save to database
        payment_doc = payment.model_dump()
        payment_doc['created_at'] = payment_doc['created_at'].isoformat()
        await service.db.payments.insert_one(payment_doc)
        
        return {
            "order_id": razorpay_order['id'],
            "amount": amount_in_cents,
            "currency": request.currency.value,
            "key_id": razorpay_key_id,
            "pricing": pricing
        }
    
    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@payment_router.post("/verify-payment")
async def verify_subscription_payment(
    request: PaymentVerifyRequest,
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Step 2: Verify payment and activate subscription
    
    CRITICAL SECURITY:
    1. Verify Razorpay signature to prevent fake payments
    2. Check payment status in database
    3. Create/extend subscription only after verification
    4. No client-side bypass possible
    """
    # Verify signature
    is_valid = await verify_razorpay_signature(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature
    )
    
    if not is_valid:
        logger.warning(f"Invalid payment signature for business {request.business_id}")
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    # Check if payment record exists
    payment_record = await service.db.payments.find_one(
        {"razorpay_order_id": request.razorpay_order_id},
        {"_id": 0}
    )
    
    if not payment_record:
        raise HTTPException(status_code=404, detail="Payment record not found")
    
    if payment_record['status'] == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Payment already processed")
    
    try:
        # Fetch payment details from Razorpay to double-check
        payment_details = razorpay_client.payment.fetch(request.razorpay_payment_id)
        
        if payment_details['status'] != 'captured':
            raise HTTPException(status_code=400, detail="Payment not captured")
        
        # Update payment record
        now = datetime.now(timezone.utc)
        await service.db.payments.update_one(
            {"razorpay_order_id": request.razorpay_order_id},
            {"$set": {
                "razorpay_payment_id": request.razorpay_payment_id,
                "razorpay_signature": request.razorpay_signature,
                "status": PaymentStatus.COMPLETED,
                "completed_at": now.isoformat()
            }}
        )
        
        # Create/extend subscription - THIS IS THE ONLY WAY TO GET ACCESS
        subscription = await service.create_subscription(
            business_id=request.business_id,
            plan_type=request.plan_type,
            currency=request.currency,
            payment_id=payment_record['id'],
            coupon_code=payment_details['notes'].get('coupon_code') if payment_details['notes'].get('coupon_code') != 'none' else None
        )
        
        # Link payment to subscription
        await service.db.payments.update_one(
            {"razorpay_order_id": request.razorpay_order_id},
            {"$set": {"subscription_id": subscription.id}}
        )
        
        logger.info(f"Payment verified and subscription created for business {request.business_id}")
        
        return {
            "success": True,
            "subscription_id": subscription.id,
            "expiry_date": subscription.expiry_date.isoformat(),
            "message": "Subscription activated successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")

@payment_router.post("/apply-coupon")
async def apply_coupon(
    request: CouponApplyRequest,
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Validate and calculate discount for coupon code
    """
    pricing = await service.calculate_price(
        request.plan_type,
        request.currency,
        request.coupon_code
    )
    
    if pricing['discount'] == 0:
        raise HTTPException(status_code=400, detail="Invalid or expired coupon code")
    
    return {
        "valid": True,
        "original_price": pricing['original_price'],
        "discount": pricing['discount'],
        "final_price": pricing['final_price'],
        "currency": pricing['currency']
    }

@payment_router.get("/plans")
async def get_subscription_plans():
    """
    Get all available subscription plans with pricing
    """
    return {
        "plans": [
            {
                "type": "monthly",
                "pricing": {
                    "CAD": {"amount": 1.99, "currency": "CAD", "symbol": "$"},
                    "INR": {"amount": 99, "currency": "INR", "symbol": "₹"}
                },
                "duration": "30 days"
            },
            {
                "type": "yearly",
                "pricing": {
                    "CAD": {"amount": 14.99, "currency": "CAD", "symbol": "$"},
                    "INR": {"amount": 799, "currency": "INR", "symbol": "₹"}
                },
                "duration": "365 days",
                "savings": "Save 37%"
            }
        ]
    }

@payment_router.get("/status/{business_id}")
async def get_subscription_status(
    business_id: str,
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Get current subscription status for business
    Used in profile dashboard
    """
    subscription = await service.get_subscription_details(business_id)
    
    if not subscription:
        return {
            "has_subscription": False,
            "status": "none",
            "message": "No active subscription"
        }
    
    return {
        "has_subscription": True,
        **subscription
    }

@payment_router.get("/payment-history/{business_id}")
async def get_payment_history(
    business_id: str,
    service: SubscriptionService = Depends(get_subscription_service)
):
    """
    Get payment history for business
    Used in profile dashboard
    """
    payments = await service.db.payments.find(
        {"business_id": business_id, "status": PaymentStatus.COMPLETED},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(50)
    
    return {"payments": payments}
