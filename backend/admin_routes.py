# Admin Routes - Complete API endpoints for admin panel

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from admin_models import (
    AdminLoginRequest, BusinessUpdate, TagAssignment, TagCreateRequest,
    TagBulkUpload, TagUnassign, TagScrap, TagReset,
    PromoCodeCreate, AdminRole, BusinessStatus, TagStatus
)
from admin_service import AdminService
import bcrypt
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_admin_service(request: Request) -> AdminService:
    """Dependency injection for admin service"""
    return AdminService(request.app.state.db)

async def verify_admin(authorization: str = Header(None), service: AdminService = Depends(get_admin_service)):
    """Verify admin authentication"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    admin = await service.verify_admin_token(token)
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return admin

# Authentication

@admin_router.post("/login")
async def admin_login(request: AdminLoginRequest, service: AdminService = Depends(get_admin_service)):
    """Admin login endpoint"""
    # Get admin by email
    admin_doc = await service.db.admins.find_one({"email": request.email, "active": True}, {"_id": 0})
    
    if not admin_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    password_valid = bcrypt.checkpw(
        request.password.encode('utf-8'),
        admin_doc['password_hash'].encode('utf-8')
    )
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    token = await service.create_admin_session(admin_doc['id'])
    
    # Update last login
    await service.db.admins.update_one(
        {"id": admin_doc['id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": token,
        "admin": {
            "id": admin_doc['id'],
            "email": admin_doc['email'],
            "name": admin_doc['name'],
            "role": admin_doc['role']
        }
    }

@admin_router.get("/me")
async def get_current_admin(admin = Depends(verify_admin)):
    """Get current admin info"""
    return {
        "id": admin.id,
        "email": admin.email,
        "name": admin.name,
        "role": admin.role
    }

# Dashboard

@admin_router.get("/dashboard/stats")
async def get_dashboard_stats(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get dashboard statistics"""
    stats = await service.get_dashboard_stats()
    return stats.model_dump()

@admin_router.get("/dashboard/notifications")
async def get_notifications(
    limit: int = 50,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get system notifications"""
    notifications = await service.get_notifications(limit)
    return {"notifications": notifications}

@admin_router.post("/dashboard/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Mark notification as read"""
    await service.db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

# New Notification Endpoints

@admin_router.get("/notifications/recent")
async def get_recent_notifications(
    limit: int = 10,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get recent notifications with unread count"""
    from notification_service import NotificationService
    notif_service = NotificationService(service.db)
    
    notifications = await notif_service.get_notifications(limit=limit)
    unread_count = await notif_service.get_unread_count()
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@admin_router.post("/notifications/mark-read")
async def mark_notifications_read(
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Mark multiple notifications as read"""
    from notification_service import NotificationService
    notif_service = NotificationService(service.db)
    
    data = await request.json()
    notification_ids = data.get("notification_ids", [])
    
    await notif_service.mark_as_read(notification_ids)
    return {"success": True}

@admin_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Mark all notifications as read"""
    from notification_service import NotificationService
    notif_service = NotificationService(service.db)
    
    await notif_service.mark_all_as_read()
    return {"success": True}

@admin_router.get("/notifications/badges")
async def get_notification_badges(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get notification badge counts for tabs"""
    from notification_service import NotificationService
    notif_service = NotificationService(service.db)
    
    badges = await notif_service.get_notification_badges()
    return badges

@admin_router.get("/businesses/alerts")
async def get_business_alerts(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get all business alerts with color coding"""
    from notification_service import NotificationService
    notif_service = NotificationService(service.db)
    
    alerts = await notif_service.get_business_alerts()
    return {"alerts": alerts}

# Business Directory

@admin_router.get("/businesses")
async def list_businesses(
    search: str = None,
    status: str = None,
    city: str = None,
    skip: int = 0,
    limit: int = 50,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """List all businesses with filters"""
    query = {}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["subscription_status"] = status
    
    if city:
        query["address"] = {"$regex": city, "$options": "i"}
    
    businesses = await service.db.businesses.find(
        query,
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.businesses.count_documents(query)
    
    return {
        "businesses": businesses,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@admin_router.get("/businesses/{business_id}")
async def get_business_detail(
    business_id: str,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get detailed business profile with analytics"""
    business = await service.db.businesses.find_one({"id": business_id}, {"_id": 0})
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get analytics
    analytics = await service.get_business_analytics(business_id)
    
    # Get tags
    tags = await service.db.tags.find(
        {"business_id": business_id},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "business": business,
        "analytics": analytics,
        "tags": tags
    }

@admin_router.put("/businesses/{business_id}")
async def update_business(
    business_id: str,
    update: BusinessUpdate,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Update business details"""
    # Get current business
    business = await service.db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Prepare update data
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Map 'status' to 'subscription_status' for the database
    if 'status' in update_data:
        update_data['subscription_status'] = update_data.pop('status')
    
    if not update_data:
        return {"success": True, "message": "No changes"}
    
    # Update business
    await service.db.businesses.update_one(
        {"id": business_id},
        {"$set": update_data}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="business_updated",
        entity_type="business",
        entity_id=business_id,
        changes={"before": business, "after": update_data},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Business updated"}

@admin_router.delete("/businesses/{business_id}")
async def delete_business(
    business_id: str,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Delete business (soft delete by setting inactive)"""
    business = await service.db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Soft delete
    await service.db.businesses.update_one(
        {"id": business_id},
        {"$set": {"subscription_status": "suspended"}}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="business_deleted",
        entity_type="business",
        entity_id=business_id,
        changes={"status": "suspended"},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Business deleted"}

# Tag Management

# Tag Management

async def log_tag_history(db, tag_id: str, action: str, admin, business_id: str = None, details: dict = None):
    """Helper to log tag history"""
    from admin_models import TagHistory
    history = TagHistory(
        tag_id=tag_id,
        action=action,
        business_id=business_id,
        admin_id=admin.id,
        admin_email=admin.email,
        details=details
    )
    history_doc = history.model_dump()
    history_doc['created_at'] = history_doc['created_at'].isoformat()
    await db.tag_history.insert_one(history_doc)

@admin_router.post("/tags/create")
async def create_tags(
    request: TagCreateRequest,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Create new tags"""
    import uuid
    from admin_models import Tag
    
    created_tags = []
    
    for i in range(request.quantity):
        # Generate tag ID if not provided
        tag_id = request.tag_id if request.tag_id and request.quantity == 1 else f"{request.tag_type.upper()}-{uuid.uuid4().hex[:8].upper()}"
        
        # Check if tag ID already exists
        existing = await service.db.tags.find_one({"tag_id": tag_id}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail=f"Tag ID {tag_id} already exists")
        
        tag = Tag(
            tag_type=request.tag_type,
            tag_id=tag_id,
            status=TagStatus.INACTIVE
        )
        
        tag_doc = tag.model_dump()
        tag_doc['created_at'] = tag_doc['created_at'].isoformat()
        
        await service.db.tags.insert_one(tag_doc)
        created_tags.append(tag_doc)
        
        # Log history
        await log_tag_history(service.db, tag_id, "created", admin)
    
    return {
        "success": True,
        "message": f"Created {len(created_tags)} tag(s)",
        "tags": created_tags
    }

@admin_router.post("/tags/bulk-upload")
async def bulk_upload_tags(
    request: TagBulkUpload,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Bulk upload tags"""
    from admin_models import Tag
    
    created_tags = []
    skipped_tags = []
    
    for tag_id in request.tag_ids:
        # Check if tag ID already exists
        existing = await service.db.tags.find_one({"tag_id": tag_id}, {"_id": 0})
        if existing:
            skipped_tags.append(tag_id)
            continue
        
        tag = Tag(
            tag_type=request.tag_type,
            tag_id=tag_id,
            status=TagStatus.INACTIVE
        )
        
        tag_doc = tag.model_dump()
        tag_doc['created_at'] = tag_doc['created_at'].isoformat()
        
        await service.db.tags.insert_one(tag_doc)
        created_tags.append(tag_doc)
        
        # Log history
        await log_tag_history(service.db, tag_id, "created", admin)
    
    return {
        "success": True,
        "message": f"Created {len(created_tags)} tags, skipped {len(skipped_tags)} duplicates",
        "created": len(created_tags),
        "skipped": skipped_tags
    }

@admin_router.get("/tags")
async def list_tags(
    status: str = None,
    business_id: str = None,
    skip: int = 0,
    limit: int = 100,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """List all tags with filters"""
    query = {}
    
    if status:
        query["status"] = status
    
    if business_id:
        query["business_id"] = business_id
    
    tags = await service.db.tags.find(
        query,
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.tags.count_documents(query)
    
    return {
        "tags": tags,
        "total": total
    }

@admin_router.post("/tags/assign")
async def assign_tag(
    assignment: TagAssignment,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Assign tag to business"""
    # Verify tag exists and is inactive
    tag = await service.db.tags.find_one({"id": assignment.tag_id}, {"_id": 0})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag['status'] not in [TagStatus.INACTIVE, "inactive"]:
        raise HTTPException(status_code=400, detail=f"Tag is {tag['status']}, can only assign inactive tags")
    
    # Verify business exists
    business = await service.db.businesses.find_one({"id": assignment.business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Assign tag
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=assignment.expires_in_days)
    
    await service.db.tags.update_one(
        {"id": assignment.tag_id},
        {"$set": {
            "status": TagStatus.PENDING,
            "business_id": assignment.business_id,
            "assigned_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "location": assignment.location
        }}
    )
    
    # Log history
    await log_tag_history(
        service.db, 
        tag['tag_id'], 
        "assigned", 
        admin, 
        assignment.business_id,
        {"location": assignment.location, "expires_in_days": assignment.expires_in_days}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="tag_assigned",
        entity_type="tag",
        entity_id=assignment.tag_id,
        changes={"business_id": assignment.business_id},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Tag assigned successfully"}

@admin_router.post("/tags/unassign")
async def unassign_tag(
    request_data: TagUnassign,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Unassign/revoke tag from business"""
    # Verify tag exists
    tag = await service.db.tags.find_one({"tag_id": request_data.tag_id}, {"_id": 0})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if not tag.get('business_id'):
        raise HTTPException(status_code=400, detail="Tag is not assigned to any business")
    
    old_business_id = tag['business_id']
    
    # Unassign tag
    await service.db.tags.update_one(
        {"tag_id": request_data.tag_id},
        {"$set": {
            "status": TagStatus.INACTIVE,
            "business_id": None,
            "assigned_at": None,
            "activated_at": None,
            "expires_at": None,
            "location": None
        }}
    )
    
    # Log history
    await log_tag_history(
        service.db, 
        request_data.tag_id, 
        "unassigned", 
        admin, 
        old_business_id,
        {"previous_business": old_business_id}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="tag_unassigned",
        entity_type="tag",
        entity_id=tag['id'],
        changes={"business_id": None, "previous_business": old_business_id},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Tag unassigned successfully"}

@admin_router.post("/tags/scrap")
async def scrap_tag(
    request_data: TagScrap,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Permanently scrap a tag (stolen/damaged/returned)"""
    # Verify tag exists
    tag = await service.db.tags.find_one({"tag_id": request_data.tag_id}, {"_id": 0})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag['status'] == TagStatus.SCRAPPED:
        raise HTTPException(status_code=400, detail="Tag is already scrapped")
    
    # Scrap tag
    now = datetime.now(timezone.utc)
    await service.db.tags.update_one(
        {"tag_id": request_data.tag_id},
        {"$set": {
            "status": TagStatus.SCRAPPED,
            "scrap_reason": request_data.reason,
            "scrapped_at": now.isoformat(),
            "business_id": None,
            "assigned_at": None,
            "activated_at": None,
            "expires_at": None
        }}
    )
    
    # Log history
    await log_tag_history(
        service.db, 
        request_data.tag_id, 
        "scrapped", 
        admin,
        details={"reason": request_data.reason}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="tag_scrapped",
        entity_type="tag",
        entity_id=tag['id'],
        changes={"status": "scrapped", "reason": request_data.reason},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Tag scrapped successfully"}

@admin_router.post("/tags/reset")
async def reset_tag(
    request_data: TagReset,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Reset a tag to inactive state (undo mistakes)"""
    # Verify tag exists
    tag = await service.db.tags.find_one({"tag_id": request_data.tag_id}, {"_id": 0})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    old_status = tag['status']
    old_business = tag.get('business_id')
    
    # Reset tag
    await service.db.tags.update_one(
        {"tag_id": request_data.tag_id},
        {"$set": {
            "status": TagStatus.INACTIVE,
            "business_id": None,
            "assigned_at": None,
            "activated_at": None,
            "expires_at": None,
            "location": None,
            "scrap_reason": None,
            "scrapped_at": None
        }}
    )
    
    # Log history
    await log_tag_history(
        service.db, 
        request_data.tag_id, 
        "reset", 
        admin,
        details={"previous_status": old_status, "previous_business": old_business}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="tag_reset",
        entity_type="tag",
        entity_id=tag['id'],
        changes={"status": "inactive", "previous_status": old_status},
        ip_address=request.client.host
    )
    
    return {"success": True, "message": "Tag reset successfully"}

@admin_router.get("/tags/{tag_id}/history")
async def get_tag_history(
    tag_id: str,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get tag activation history"""
    history = await service.db.tag_history.find(
        {"tag_id": tag_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"history": history}

# Promo Codes

@admin_router.get("/promo-codes")
async def list_promo_codes(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """List all promo codes"""
    promos = await service.db.coupons.find({}, {"_id": 0}).to_list(100)
    return {"promo_codes": promos}

@admin_router.post("/promo-codes")
async def create_promo_code(
    promo: PromoCodeCreate,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Create new promo code"""
    # Check if code already exists
    existing = await service.db.coupons.find_one({"code": promo.code.upper()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    from subscription_models import Coupon
    
    coupon = Coupon(
        code=promo.code.upper(),
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        valid_from=promo.valid_from,
        valid_until=promo.valid_until,
        usage_limit=promo.max_uses
    )
    
    coupon_doc = coupon.model_dump()
    coupon_doc['valid_from'] = coupon_doc['valid_from'].isoformat()
    coupon_doc['valid_until'] = coupon_doc['valid_until'].isoformat()
    coupon_doc['created_at'] = coupon_doc['created_at'].isoformat()
    
    await service.db.coupons.insert_one(coupon_doc)
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="promo_code_created",
        entity_type="coupon",
        entity_id=coupon.id,
        changes={"code": promo.code},
        ip_address=request.client.host
    )
    
    return {"success": True, "promo_code": coupon_doc}

# Audit Logs

@admin_router.get("/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get audit logs"""
    logs = await service.db.audit_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"logs": logs}

# Support Tickets Management

@admin_router.get("/tickets")
async def list_tickets(
    status: str = None,
    priority: str = None,
    skip: int = 0,
    limit: int = 50,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """List all support tickets"""
    query = {}
    
    if status:
        query["status"] = status
    
    if priority:
        query["priority"] = priority
    
    tickets = await service.db.support_tickets.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.support_tickets.count_documents(query)
    
    # Get counts by status
    open_count = await service.db.support_tickets.count_documents({"status": "open"})
    pending_count = await service.db.support_tickets.count_documents({"status": "pending"})
    
    return {
        "tickets": tickets,
        "total": total,
        "open_count": open_count,
        "pending_count": pending_count
    }

@admin_router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get ticket details"""
    ticket = await service.db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return ticket

@admin_router.put("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update: dict,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Update ticket status/priority/notes"""
    ticket = await service.db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = {k: v for k, v in update.items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # If marking as resolved, set resolved_at
    if update_data.get('status') == 'resolved':
        update_data['resolved_at'] = datetime.now(timezone.utc).isoformat()
    
    await service.db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": update_data}
    )
    
    # Log action
    await service.log_admin_action(
        admin=admin,
        action="ticket_updated",
        entity_type="ticket",
        entity_id=ticket_id,
        changes=update_data,
        ip_address=request.client.host
    )
    
    # Update notification if exists
    if update_data.get('status') == 'resolved':
        await service.db.notifications.update_one(
            {"related_id": ticket_id},
            {"$set": {"read": True}}
        )
    
    return {"success": True, "message": "Ticket updated successfully"}
