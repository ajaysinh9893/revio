# Subscription Middleware - Protect Routes Based on Subscription Status
# This middleware checks if business has active subscription before allowing access

from fastapi import Request, HTTPException
from subscription_service import SubscriptionService
import logging

logger = logging.getLogger(__name__)

class SubscriptionMiddleware:
    """
    CRITICAL SECURITY: Middleware to check subscription status
    Prevents access to protected features without active subscription
    """
    
    def __init__(self, app, db):
        self.app = app
        self.db = db
        self.subscription_service = SubscriptionService(db)
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        path = request.url.path
        
        # List of protected endpoints that require active subscription
        protected_endpoints = [
            "/api/business/{business_id}/qr",  # QR code access
            "/api/business/{business_id}/reviews",  # Review access
        ]
        
        # Check if this is a protected endpoint
        is_protected = any(
            path.startswith(endpoint.split("{")[0]) 
            for endpoint in protected_endpoints
        )
        
        if is_protected and "/qr" in path:
            # Extract business_id from path
            path_parts = path.split("/")
            if len(path_parts) >= 4:
                business_id = path_parts[3]
                
                # Check subscription status
                has_active_subscription = await self.subscription_service.check_subscription_active(business_id)
                
                if not has_active_subscription:
                    # Return 403 Forbidden with clear message
                    error_response = {
                        "detail": "Subscription expired or inactive. Please renew your subscription to access this feature.",
                        "status_code": 403
                    }
                    
                    from starlette.responses import JSONResponse
                    response = JSONResponse(error_response, status_code=403)
                    await response(scope, receive, send)
                    return
        
        # Continue to the actual endpoint
        await self.app(scope, receive, send)


async def check_subscription_or_trial(business_id: str, db) -> bool:
    """
    Check if business has active subscription (NO TRIAL)
    Returns True if subscription is active
    """
    subscription_service = SubscriptionService(db)
    
    # Check active subscription only
    has_subscription = await subscription_service.check_subscription_active(business_id)
    return has_subscription
