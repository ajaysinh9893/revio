# Tag Pair Routes - QR & NFC Tag Inventory Management

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from tag_pair_models import (
    TagPair, TagPairCreate, TagPairBulkCreate, TagPairAssign,
    TagPairUpdate, TagPairActivityLog, TagPairStatus
)
from admin_service import AdminService
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

tag_pair_router = APIRouter(prefix="/api/admin/tag-pairs", tags=["tag-pairs"])

def get_admin_service(request: Request) -> AdminService:
    return AdminService(request.app.state.db)

async def verify_admin(authorization: str = Header(None), service: AdminService = Depends(get_admin_service)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    admin = await service.verify_admin_token(token)
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return admin

async def log_activity(db, pair_id: str, action: str, admin, previous_state: dict = None, new_state: dict = None, ip: str = None, notes: str = None):
    """Log tag pair activity"""
    activity = TagPairActivityLog(
        pair_id=pair_id,
        action=action,
        performed_by=admin.email,
        previous_state=previous_state,
        new_state=new_state,
        notes=notes,
        ip_address=ip
    )
    activity_doc = activity.model_dump()
    activity_doc['timestamp'] = activity_doc['timestamp'].isoformat()
    await db.tag_pair_activities.insert_one(activity_doc)

@tag_pair_router.post("/create")
async def create_tag_pair(
    pair_data: TagPairCreate,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Create a new QR-NFC tag pair"""
    # Check if QR ID or NFC ID already exists
    existing_qr = await service.db.tag_pairs.find_one({"qr_id": pair_data.qr_id}, {"_id": 0})
    if existing_qr:
        raise HTTPException(status_code=400, detail=f"QR ID {pair_data.qr_id} already exists")
    
    existing_nfc = await service.db.tag_pairs.find_one({"nfc_id": pair_data.nfc_id}, {"_id": 0})
    if existing_nfc:
        raise HTTPException(status_code=400, detail=f"NFC ID {pair_data.nfc_id} already exists")
    
    # Create tag pair
    tag_pair = TagPair(
        qr_id=pair_data.qr_id,
        nfc_id=pair_data.nfc_id,
        notes=pair_data.notes
    )
    
    pair_doc = tag_pair.model_dump()
    pair_doc['created_at'] = pair_doc['created_at'].isoformat()
    pair_doc['updated_at'] = pair_doc['updated_at'].isoformat()
    
    await service.db.tag_pairs.insert_one(pair_doc)
    
    # Log activity
    await log_activity(
        service.db, tag_pair.pair_id, "Created",
        admin, None, {"pair_id": tag_pair.pair_id, "qr_id": pair_data.qr_id, "nfc_id": pair_data.nfc_id},
        request.client.host
    )
    
    return {"success": True, "pair": pair_doc}

@tag_pair_router.post("/bulk-create")
async def bulk_create_tag_pairs(
    bulk_data: TagPairBulkCreate,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Bulk create tag pairs"""
    created_pairs = []
    skipped_pairs = []
    
    for pair_data in bulk_data.pairs:
        qr_id = pair_data.get("qr_id")
        nfc_id = pair_data.get("nfc_id")
        
        if not qr_id or not nfc_id:
            skipped_pairs.append({"reason": "Missing QR or NFC ID", "data": pair_data})
            continue
        
        # Check duplicates
        existing = await service.db.tag_pairs.find_one(
            {"$or": [{"qr_id": qr_id}, {"nfc_id": nfc_id}]},
            {"_id": 0}
        )
        if existing:
            skipped_pairs.append({"reason": "Duplicate ID", "data": pair_data})
            continue
        
        # Create pair
        tag_pair = TagPair(qr_id=qr_id, nfc_id=nfc_id)
        pair_doc = tag_pair.model_dump()
        pair_doc['created_at'] = pair_doc['created_at'].isoformat()
        pair_doc['updated_at'] = pair_doc['updated_at'].isoformat()
        
        await service.db.tag_pairs.insert_one(pair_doc)
        created_pairs.append(pair_doc)
        
        # Log activity
        await log_activity(
            service.db, tag_pair.pair_id, "Created (Bulk)",
            admin, None, {"pair_id": tag_pair.pair_id},
            request.client.host
        )
    
    return {
        "success": True,
        "created": len(created_pairs),
        "skipped": len(skipped_pairs),
        "skipped_details": skipped_pairs
    }

@tag_pair_router.get("/list")
async def list_tag_pairs(
    status: str = None,
    business_id: str = None,
    search: str = None,
    skip: int = 0,
    limit: int = 100,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """List all tag pairs with filters"""
    query = {"status": {"$ne": "deleted"}}  # Don't show deleted pairs
    
    if status:
        query["status"] = status
    
    if business_id:
        query["business_id"] = business_id
    
    if search:
        query["$or"] = [
            {"pair_id": {"$regex": search, "$options": "i"}},
            {"qr_id": {"$regex": search, "$options": "i"}},
            {"nfc_id": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}}
        ]
    
    pairs = await service.db.tag_pairs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.tag_pairs.count_documents(query)
    
    return {
        "pairs": pairs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@tag_pair_router.post("/assign")
async def assign_tag_pair(
    assignment: TagPairAssign,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Assign tag pair to a business"""
    # Get tag pair
    pair = await service.db.tag_pairs.find_one({"pair_id": assignment.pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    if pair['status'] not in ["unassigned", "inactive"]:
        raise HTTPException(status_code=400, detail=f"Tag pair is {pair['status']}, cannot assign")
    
    # Get business
    business = await service.db.businesses.find_one({"id": assignment.business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    previous_state = {"status": pair['status'], "business_id": pair.get('business_id')}
    
    # Assign pair
    update_data = {
        "status": "assigned",
        "business_id": assignment.business_id,
        "business_name": business.get('name'),
        "business_location": assignment.business_location or business.get('address'),
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "assigned_by": admin.email,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await service.db.tag_pairs.update_one(
        {"pair_id": assignment.pair_id},
        {"$set": update_data}
    )
    
    # Log activity
    await log_activity(
        service.db, assignment.pair_id, "Assign",
        admin, previous_state, update_data,
        request.client.host,
        f"Assigned to {business.get('name')}"
    )
    
    return {"success": True, "message": "Tag pair assigned successfully"}

@tag_pair_router.post("/reassign")
async def reassign_tag_pair(
    assignment: TagPairAssign,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Reassign tag pair to a different business"""
    # Get tag pair
    pair = await service.db.tag_pairs.find_one({"pair_id": assignment.pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    # Get business
    business = await service.db.businesses.find_one({"id": assignment.business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    previous_state = {
        "status": pair['status'],
        "business_id": pair.get('business_id'),
        "business_name": pair.get('business_name')
    }
    
    # Reassign pair
    update_data = {
        "status": "assigned",
        "business_id": assignment.business_id,
        "business_name": business.get('name'),
        "business_location": assignment.business_location or business.get('address'),
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "assigned_by": admin.email,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await service.db.tag_pairs.update_one(
        {"pair_id": assignment.pair_id},
        {"$set": update_data}
    )
    
    # Log activity
    await log_activity(
        service.db, assignment.pair_id, "Reassign",
        admin, previous_state, update_data,
        request.client.host,
        f"Reassigned from {previous_state['business_name']} to {business.get('name')}"
    )
    
    return {"success": True, "message": "Tag pair reassigned successfully"}

@tag_pair_router.post("/activate/{pair_id}")
async def activate_tag_pair(
    pair_id: str,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Activate tag pair"""
    pair = await service.db.tag_pairs.find_one({"pair_id": pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    if pair['status'] == "active":
        raise HTTPException(status_code=400, detail="Tag pair is already active")
    
    previous_state = {"status": pair['status']}
    
    update_data = {
        "status": "active",
        "activated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await service.db.tag_pairs.update_one(
        {"pair_id": pair_id},
        {"$set": update_data}
    )
    
    # Log activity
    await log_activity(
        service.db, pair_id, "Activate",
        admin, previous_state, update_data,
        request.client.host
    )
    
    return {"success": True, "message": "Tag pair activated successfully"}

@tag_pair_router.post("/deactivate/{pair_id}")
async def deactivate_tag_pair(
    pair_id: str,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Deactivate tag pair"""
    pair = await service.db.tag_pairs.find_one({"pair_id": pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    if pair['status'] == "inactive":
        raise HTTPException(status_code=400, detail="Tag pair is already inactive")
    
    previous_state = {"status": pair['status']}
    
    update_data = {
        "status": "inactive",
        "deactivated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await service.db.tag_pairs.update_one(
        {"pair_id": pair_id},
        {"$set": update_data}
    )
    
    # Log activity
    await log_activity(
        service.db, pair_id, "Deactivate",
        admin, previous_state, update_data,
        request.client.host
    )
    
    return {"success": True, "message": "Tag pair deactivated successfully"}

@tag_pair_router.delete("/delete/{pair_id}")
async def delete_tag_pair(
    pair_id: str,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Soft delete tag pair"""
    pair = await service.db.tag_pairs.find_one({"pair_id": pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    previous_state = pair.copy()
    
    update_data = {
        "status": "deleted",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await service.db.tag_pairs.update_one(
        {"pair_id": pair_id},
        {"$set": update_data}
    )
    
    # Log activity
    await log_activity(
        service.db, pair_id, "Delete",
        admin, previous_state, update_data,
        request.client.host
    )
    
    return {"success": True, "message": "Tag pair deleted successfully"}

@tag_pair_router.put("/update")
async def update_tag_pair(
    update_data: TagPairUpdate,
    request: Request,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Update tag pair details"""
    pair = await service.db.tag_pairs.find_one({"pair_id": update_data.pair_id}, {"_id": 0})
    if not pair:
        raise HTTPException(status_code=404, detail="Tag pair not found")
    
    previous_state = pair.copy()
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.status:
        updates["status"] = update_data.status
    if update_data.business_location:
        updates["business_location"] = update_data.business_location
    if update_data.notes is not None:
        updates["notes"] = update_data.notes
    
    await service.db.tag_pairs.update_one(
        {"pair_id": update_data.pair_id},
        {"$set": updates}
    )
    
    # Log activity
    await log_activity(
        service.db, update_data.pair_id, "Update",
        admin, previous_state, updates,
        request.client.host
    )
    
    return {"success": True, "message": "Tag pair updated successfully"}

@tag_pair_router.get("/activity-log/{pair_id}")
async def get_activity_log(
    pair_id: str,
    skip: int = 0,
    limit: int = 50,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get activity log for a specific tag pair"""
    activities = await service.db.tag_pair_activities.find(
        {"pair_id": pair_id},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.tag_pair_activities.count_documents({"pair_id": pair_id})
    
    return {
        "activities": activities,
        "total": total
    }

@tag_pair_router.get("/activity-log")
async def get_all_activities(
    skip: int = 0,
    limit: int = 100,
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get all tag pair activities"""
    activities = await service.db.tag_pair_activities.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await service.db.tag_pair_activities.count_documents({})
    
    return {
        "activities": activities,
        "total": total
    }

@tag_pair_router.get("/stats")
async def get_tag_pair_stats(
    admin = Depends(verify_admin),
    service: AdminService = Depends(get_admin_service)
):
    """Get tag pair statistics"""
    total = await service.db.tag_pairs.count_documents({"status": {"$ne": "deleted"}})
    unassigned = await service.db.tag_pairs.count_documents({"status": "unassigned"})
    assigned = await service.db.tag_pairs.count_documents({"status": "assigned"})
    active = await service.db.tag_pairs.count_documents({"status": "active"})
    inactive = await service.db.tag_pairs.count_documents({"status": "inactive"})
    
    return {
        "total": total,
        "unassigned": unassigned,
        "assigned": assigned,
        "active": active,
        "inactive": inactive
    }
