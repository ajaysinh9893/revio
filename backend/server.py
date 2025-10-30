from fastapi import FastAPI, APIRouter, HTTPException, Header, Response, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import qrcode
from io import BytesIO
import base64
import httpx
import razorpay

# Import subscription system
from subscription_service import SubscriptionService
from payment_routes import payment_router
from subscription_middleware import check_subscription_or_trial
from google_business_service import GoogleBusinessService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID', '')
razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
if razorpay_key_id and razorpay_key_secret:
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
else:
    razorpay_client = None

app = FastAPI()

# Store database in app state for dependency injection
app.state.db = db

api_router = APIRouter(prefix="/api")

# Models
class Business(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    google_place_id: str
    owner_email: str
    qr_code: Optional[str] = None
    verified: bool = False
    subscription_status: str = "inactive"  # inactive, active, expired
    subscription_expires_at: Optional[datetime] = None
    payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    auto_renewal_enabled: bool = False
    google_verified: bool = False
    google_access_token: Optional[str] = None
    google_refresh_token: Optional[str] = None
    google_token_expires_at: Optional[datetime] = None
    google_account_name: Optional[str] = None
    google_location_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusinessCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    google_place_id: str
    owner_email: str

class PaymentOrderCreate(BaseModel):
    business_id: str
    amount: int = 49900  # ₹499 in paise
    currency: str = "INR"

class PaymentVerify(BaseModel):
    business_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    picture: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    customer_email: str
    customer_name: str
    rating: int
    keywords: str
    generated_review: str
    posted_to_google: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewGenerate(BaseModel):
    rating: int
    keywords: str
    business_name: str
    language: str = "English"
    sentiment: str = "Positive"  # Positive, Neutral, Negative

class ReviewSubmit(BaseModel):
    business_id: str
    rating: int
    keywords: str
    generated_review: str

class SessionData(BaseModel):
    session_id: str

# Helper functions
async def check_subscription_status(business: Business) -> bool:
    """Check if business has active subscription or trial"""
    now = datetime.now(timezone.utc)
    
    if business.subscription_status == "active":
        if business.subscription_expires_at and business.subscription_expires_at > now:
            return True
    elif business.subscription_status == "trial":
        if business.trial_ends_at and business.trial_ends_at > now:
            return True
    
    return False

async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({
        "session_token": session_token,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    if not session:
        return None
    
    user_doc = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if user_doc and isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    return User(**user_doc) if user_doc else None

# Routes
@api_router.post("/business/register", response_model=Business)
async def register_business(input: BusinessCreate):
    business_obj = Business(**input.model_dump())
    
    # Generate QR code URL
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    qr_url = f"{frontend_url}/review/{business_obj.id}"
    business_obj.qr_code = qr_url
    
    doc = business_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('subscription_expires_at'):
        doc['subscription_expires_at'] = doc['subscription_expires_at'].isoformat()
    
    await db.businesses.insert_one(doc)
    return business_obj

@api_router.get("/business/{business_id}", response_model=Business)
async def get_business(business_id: str):
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if isinstance(business.get('created_at'), str):
        business['created_at'] = datetime.fromisoformat(business['created_at'])
    if isinstance(business.get('trial_ends_at'), str):
        business['trial_ends_at'] = datetime.fromisoformat(business['trial_ends_at'])
    if business.get('subscription_expires_at') and isinstance(business['subscription_expires_at'], str):
        business['subscription_expires_at'] = datetime.fromisoformat(business['subscription_expires_at'])
    
    return Business(**business)

@api_router.put("/business/{business_id}")
async def update_business(business_id: str, request: Request):
    """Update business information"""
    data = await request.json()
    
    # Check if business exists
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Prepare update data
    update_data = {}
    if 'name' in data and data['name']:
        update_data['name'] = data['name']
    if 'category' in data:
        update_data['category'] = data['category']
    if 'email' in data and data['email']:
        update_data['email'] = data['email']
    if 'phone' in data:
        update_data['phone'] = data['phone']
    if 'address' in data:
        update_data['address'] = data['address']
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Update business
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": update_data}
    )
    
    # Get updated business
    updated_business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    
    return {"success": True, "business": updated_business}

@api_router.post("/payment/create-order")
async def create_payment_order(order: PaymentOrderCreate):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured. Please add Razorpay credentials.")
    
    # Verify business exists
    business = await db.businesses.find_one({"id": order.business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    try:
        # Create Razorpay order
        razor_order = razorpay_client.order.create({
            "amount": order.amount,
            "currency": order.currency,
            "payment_capture": 1,
            "notes": {
                "business_id": order.business_id,
                "business_name": business['name']
            }
        })
        
        # Update business with order ID
        await db.businesses.update_one(
            {"id": order.business_id},
            {"$set": {"razorpay_order_id": razor_order["id"]}}
        )
        
        return {
            "order_id": razor_order["id"],
            "amount": razor_order["amount"],
            "currency": razor_order["currency"],
            "key_id": razorpay_key_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@api_router.post("/payment/verify")
async def verify_payment(payment: PaymentVerify):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': payment.razorpay_order_id,
            'razorpay_payment_id': payment.razorpay_payment_id,
            'razorpay_signature': payment.razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Update business subscription
        now = datetime.now(timezone.utc)
        subscription_expires_at = now + timedelta(days=365)
        
        await db.businesses.update_one(
            {"id": payment.business_id},
            {
                "$set": {
                    "subscription_status": "active",
                    "subscription_expires_at": subscription_expires_at.isoformat(),
                    "razorpay_payment_id": payment.razorpay_payment_id,
                    "payment_id": payment.razorpay_payment_id,
                    "auto_renewal_enabled": True
                }
            }
        )
        
        return {
            "success": True,
            "message": "Payment verified successfully",
            "subscription_expires_at": subscription_expires_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")

@api_router.get("/business/{business_id}/subscription-status")
async def get_subscription_status(business_id: str):
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if isinstance(business.get('trial_ends_at'), str):
        business['trial_ends_at'] = datetime.fromisoformat(business['trial_ends_at'])
    if business.get('subscription_expires_at') and isinstance(business['subscription_expires_at'], str):
        business['subscription_expires_at'] = datetime.fromisoformat(business['subscription_expires_at'])
    
    business_obj = Business(**business)
    is_active = await check_subscription_status(business_obj)
    
    now = datetime.now(timezone.utc)
    days_remaining = 0
    
    if business_obj.subscription_status == "active" and business_obj.subscription_expires_at:
        days_remaining = (business_obj.subscription_expires_at - now).days
    elif business_obj.subscription_status == "trial" and business_obj.trial_ends_at:
        days_remaining = (business_obj.trial_ends_at - now).days
    
    return {
        "is_active": is_active,
        "status": business_obj.subscription_status,
        "days_remaining": max(0, days_remaining),
        "trial_ends_at": business_obj.trial_ends_at.isoformat() if business_obj.trial_ends_at else None,
        "subscription_expires_at": business_obj.subscription_expires_at.isoformat() if business_obj.subscription_expires_at else None,
        "needs_payment": not is_active
    }

@api_router.get("/business/{business_id}/qr")
async def get_qr_code(business_id: str):
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # CRITICAL: Check subscription or trial status using new service
    has_access = await check_subscription_or_trial(business_id, db)
    
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail="Subscription expired or trial ended. Please purchase a subscription to access your QR code."
        )
    
    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(business['qr_code'])
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

@api_router.post("/auth/session")
async def create_session(data: SessionData, response: Response):
    session_id = data.session_id
    
    # Call Emergent auth service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            resp.raise_for_status()
            user_data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to validate session: {str(e)}")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if not existing_user:
        # Create new user
        user = User(
            id=user_data["id"],
            email=user_data["email"],
            name=user_data["name"],
            picture=user_data["picture"]
        )
        user_doc = user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = user_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = UserSession(
        user_id=user_data["id"],
        session_token=session_token,
        expires_at=expires_at
    )
    
    session_doc = session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    session_doc['created_at'] = session_doc['created_at'].isoformat()
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    return {"user": user_data, "session_token": session_token}

@api_router.get("/auth/me", response_model=User)
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}


# Google My Business API Integration
google_service = GoogleBusinessService()

@api_router.get("/auth/google/initiate")
async def initiate_google_auth(business_id: str):
    """Initiate Google OAuth flow for business verification"""
    try:
        # Verify business exists
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        # Generate authorization URL with business_id as state
        authorization_url, state = google_service.get_authorization_url(business_id)
        
        return {
            "authorization_url": authorization_url,
            "state": state
        }
    except Exception as e:
        logger.error(f"Error initiating Google auth: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate Google authorization: {str(e)}")

@api_router.get("/auth/google/callback")
async def google_auth_callback(code: str, state: str):
    """Handle Google OAuth callback"""
    try:
        business_id = state
        
        # Exchange code for tokens
        tokens = google_service.exchange_code_for_tokens(code)
        
        # Fetch Google accounts
        accounts = google_service.get_business_accounts(tokens['access_token'])
        
        if not accounts:
            raise HTTPException(status_code=404, detail="No Google Business accounts found. Please create a Google Business Profile first.")
        
        # Store tokens in database
        update_data = {
            "google_verified": True,
            "google_access_token": tokens['access_token'],
            "google_refresh_token": tokens.get('refresh_token'),
            "google_token_expires_at": tokens.get('expires_at')
        }
        
        # If only one account, auto-select it
        if len(accounts) == 1:
            update_data['google_account_name'] = accounts[0].get('name')
        
        await db.businesses.update_one(
            {"id": business_id},
            {"$set": update_data}
        )
        
        # Redirect to dashboard with success
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return Response(
            content=f"""
            <html>
                <body>
                    <script>
                        window.opener.postMessage({{ type: 'GOOGLE_AUTH_SUCCESS', businessId: '{business_id}' }}, '*');
                        window.close();
                    </script>
                    <p>Authorization successful! You can close this window.</p>
                </body>
            </html>
            """,
            media_type="text/html"
        )
    except Exception as e:
        logger.error(f"Error in Google callback: {str(e)}")
        return Response(
            content=f"""
            <html>
                <body>
                    <script>
                        window.opener.postMessage({{ type: 'GOOGLE_AUTH_ERROR', error: '{str(e)}' }}, '*');
                        window.close();
                    </script>
                    <p>Authorization failed: {str(e)}</p>
                </body>
            </html>
            """,
            media_type="text/html"
        )

@api_router.get("/google/accounts/{business_id}")
async def get_google_accounts(business_id: str):
    """Fetch Google Business accounts for a business"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        accounts = google_service.get_business_accounts(business['google_access_token'])
        
        return {
            "success": True,
            "accounts": accounts,
            "selected_account": business.get('google_account_name')
        }
    except Exception as e:
        logger.error(f"Error fetching Google accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google accounts: {str(e)}")

@api_router.post("/google/select-account/{business_id}")
async def select_google_account(business_id: str, account_name: str):
    """Select a specific Google Business account"""
    try:
        await db.businesses.update_one(
            {"id": business_id},
            {"$set": {"google_account_name": account_name}}
        )
        
        return {"success": True, "message": "Account selected successfully"}
    except Exception as e:
        logger.error(f"Error selecting account: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to select account")

@api_router.get("/google/locations/{business_id}")
async def get_google_locations(business_id: str):
    """Fetch Google Business locations for a business"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        if not business.get('google_account_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business account first")
        
        locations = google_service.get_business_locations(
            business['google_access_token'],
            business['google_account_name']
        )
        
        return {
            "success": True,
            "locations": locations,
            "selected_location": business.get('google_location_name')
        }
    except Exception as e:
        logger.error(f"Error fetching Google locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google locations: {str(e)}")

@api_router.post("/google/select-location/{business_id}")
async def select_google_location(business_id: str, location_name: str):
    """Select a specific Google Business location"""
    try:
        await db.businesses.update_one(
            {"id": business_id},
            {"$set": {"google_location_name": location_name}}
        )
        
        return {"success": True, "message": "Location selected successfully"}
    except Exception as e:
        logger.error(f"Error selecting location: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to select location")

@api_router.get("/google/reviews/{business_id}")
async def get_google_reviews(business_id: str, page_size: int = 50):
    """Fetch Google reviews for a business location"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        if not business.get('google_location_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business location first")
        
        reviews_data = google_service.get_location_reviews(
            business['google_access_token'],
            business['google_location_name'],
            page_size
        )
        
        return {
            "success": True,
            "data": reviews_data
        }
    except Exception as e:
        logger.error(f"Error fetching Google reviews: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google reviews: {str(e)}")


@api_router.get("/google/reviews-filtered/{business_id}")
async def get_google_reviews_filtered(
    business_id: str,
    rating_filter: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    keyword: Optional[str] = None,
    sort_by: str = "newest"
):
    """Fetch filtered and sorted Google reviews"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        if not business.get('google_location_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business location first")
        
        # Fetch all reviews
        reviews_data = google_service.get_location_reviews(
            business['google_access_token'],
            business['google_location_name'],
            100  # Fetch more for filtering
        )
        
        reviews = reviews_data['reviews']
        
        # Apply filters
        if rating_filter:
            reviews = [r for r in reviews if r['rating'] == rating_filter]
        
        if date_from:
            reviews = [r for r in reviews if r['create_time'] >= date_from]
        
        if date_to:
            reviews = [r for r in reviews if r['create_time'] <= date_to]
        
        if keyword:
            keyword_lower = keyword.lower()
            reviews = [r for r in reviews if keyword_lower in r['comment'].lower()]
        
        # Apply sorting
        if sort_by == "newest":
            reviews.sort(key=lambda x: x['create_time'], reverse=True)
        elif sort_by == "oldest":
            reviews.sort(key=lambda x: x['create_time'])
        elif sort_by == "highest":
            reviews.sort(key=lambda x: x['rating'], reverse=True)
        elif sort_by == "lowest":
            reviews.sort(key=lambda x: x['rating'])
        
        return {
            "success": True,
            "reviews": reviews,
            "total": len(reviews),
            "average_rating": reviews_data['average_rating'],
            "total_review_count": reviews_data['total_review_count']
        }
    except Exception as e:
        logger.error(f"Error fetching filtered reviews: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch filtered reviews: {str(e)}")

@api_router.get("/google/keywords/{business_id}")
async def get_review_keywords(business_id: str):
    """Extract keywords and insights from reviews"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        if not business.get('google_location_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business location first")
        
        # Fetch reviews
        reviews_data = google_service.get_location_reviews(
            business['google_access_token'],
            business['google_location_name'],
            100
        )
        
        # Extract keywords
        keywords = google_service.extract_keywords(reviews_data['reviews'])
        
        # Calculate insights
        total_reviews = len(reviews_data['reviews'])
        positive_reviews = len([r for r in reviews_data['reviews'] if r['rating'] >= 4])
        negative_reviews = len([r for r in reviews_data['reviews'] if r['rating'] <= 2])
        neutral_reviews = total_reviews - positive_reviews - negative_reviews
        
        # Find reviews with common complaints/praise
        highlighted_reviews = {
            'complaints': [r for r in reviews_data['reviews'] if r['rating'] <= 2][:5],
            'praise': [r for r in reviews_data['reviews'] if r['rating'] == 5][:5]
        }
        
        return {
            "success": True,
            "keywords": keywords,
            "insights": {
                "total_reviews": total_reviews,
                "positive_reviews": positive_reviews,
                "negative_reviews": negative_reviews,
                "neutral_reviews": neutral_reviews,
                "positive_percentage": round((positive_reviews / total_reviews * 100) if total_reviews > 0 else 0, 1),
                "negative_percentage": round((negative_reviews / total_reviews * 100) if total_reviews > 0 else 0, 1)
            },
            "highlighted_reviews": highlighted_reviews
        }
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract keywords: {str(e)}")

@api_router.get("/google/metrics/{business_id}")
async def get_review_metrics(business_id: str):
    """Get rating trends and metrics"""
    try:
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            raise HTTPException(status_code=403, detail="Business not verified with Google")
        
        if not business.get('google_location_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business location first")
        
        # Fetch reviews
        reviews_data = google_service.get_location_reviews(
            business['google_access_token'],
            business['google_location_name'],
            100
        )
        
        reviews = reviews_data['reviews']
        
        # Calculate rating distribution
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for review in reviews:
            rating_distribution[review['rating']] = rating_distribution.get(review['rating'], 0) + 1
        
        # Calculate trends (last 30 days vs previous 30 days)
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)
        
        recent_reviews = []
        previous_reviews = []
        
        for review in reviews:
            try:
                review_date = datetime.fromisoformat(review['create_time'].replace('Z', '+00:00'))
                if review_date >= thirty_days_ago:
                    recent_reviews.append(review)
                elif review_date >= sixty_days_ago:
                    previous_reviews.append(review)
            except:
                pass
        
        recent_avg = sum(r['rating'] for r in recent_reviews) / len(recent_reviews) if recent_reviews else 0
        previous_avg = sum(r['rating'] for r in previous_reviews) / len(previous_reviews) if previous_reviews else 0
        trend = recent_avg - previous_avg
        
        return {
            "success": True,
            "metrics": {
                "average_rating": reviews_data['average_rating'],
                "total_reviews": reviews_data['total_review_count'],
                "rating_distribution": rating_distribution,
                "recent_count": len(recent_reviews),
                "trend": round(trend, 2),
                "trend_direction": "up" if trend > 0 else "down" if trend < 0 else "stable"
            }
        }
    except Exception as e:
        logger.error(f"Error fetching metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {str(e)}")


@api_router.post("/google/generate-reply")
async def generate_ai_reply(request: Request):
    """Generate AI-powered reply suggestion for a review"""
    try:
        data = await request.json()
        reviewer_name = data.get('reviewer_name', 'Customer')
        rating = data.get('rating', 3)
        comment = data.get('comment', '')
        business_name = data.get('business_name', 'our business')
        
        # Get OpenAI key from env
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        # Create appropriate prompt based on rating
        if rating >= 4:
            # Positive review
            prompt = f"""You are a professional business owner responding to a positive Google review.

Review from {reviewer_name} ({rating} stars):
"{comment}"

Write a warm, grateful response (2-3 sentences) that:
- Thanks the customer by name
- Mentions specific positive points from their review
- Invites them to return

Business name: {business_name}
Keep it professional, friendly, and concise."""
        elif rating == 3:
            # Neutral review
            prompt = f"""You are a professional business owner responding to a neutral Google review.

Review from {reviewer_name} ({rating} stars):
"{comment}"

Write a thoughtful response (2-3 sentences) that:
- Thanks the customer for their feedback
- Acknowledges their experience
- Mentions commitment to improvement
- Invites them to return

Business name: {business_name}
Keep it professional and constructive."""
        else:
            # Negative review
            prompt = f"""You are a professional business owner responding to a negative Google review.

Review from {reviewer_name} ({rating} stars):
"{comment}"

Write a sincere, empathetic response (3-4 sentences) that:
- Apologizes for their experience
- Acknowledges specific concerns mentioned
- Offers to make it right or resolve the issue
- Provides contact information or next steps

Business name: {business_name}
Keep it professional, understanding, and solution-focused."""
        
        # Call OpenAI API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant that writes professional business review responses."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 200
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                suggested_reply = result['choices'][0]['message']['content'].strip()
                
                return {
                    "success": True,
                    "suggested_reply": suggested_reply
                }
            else:
                error_detail = response.text
                logger.error(f"OpenAI API error: {error_detail}")
                raise HTTPException(status_code=500, detail=f"Failed to generate reply: {error_detail}")
                
    except Exception as e:
        logger.error(f"Error generating AI reply: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate reply: {str(e)}")

@api_router.post("/google/post-reply/{business_id}/{review_id}")
async def post_review_reply(business_id: str, review_id: str, request: Request):
    """Post a reply to a Google review"""
    try:
        data = await request.json()
        reply_text = data.get('reply_text', '')
        
        if not reply_text:
            raise HTTPException(status_code=400, detail="Reply text is required")
        
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        if not business.get('google_verified') or not business.get('google_access_token'):
            # For demo/testing: Save reply to database instead
            logger.info(f"Business not verified with Google, saving reply to database")
            
            # Store reply in database
            reply_record = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "review_id": review_id,
                "reply_text": reply_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending_google_verification"
            }
            
            await db.review_replies.insert_one(reply_record)
            
            return {
                "success": True,
                "message": "Reply saved! Please verify your Google Business Profile to post replies.",
                "demo_mode": True
            }
        
        if not business.get('google_location_name'):
            raise HTTPException(status_code=400, detail="Please select a Google Business location first")
        
        # Post reply to Google using Business Profile Performance API
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            credentials = Credentials(
                token=business['google_access_token'],
                refresh_token=business.get('google_refresh_token'),
                token_uri='https://oauth2.googleapis.com/token',
                client_id=os.environ.get('GOOGLE_CLIENT_ID'),
                client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
            )
            
            # Use Business Profile Performance API (newer version)
            service = build('mybusinessbusinessinformation', 'v1', credentials=credentials)
            
            # Update review reply
            review_name = f"{business['google_location_name']}/reviews/{review_id}"
            reply_body = {
                "comment": reply_text
            }
            
            # Try to update the reply
            service.accounts().locations().reviews().updateReply(
                name=review_name,
                body=reply_body
            ).execute()
            
            # Store successful reply in database
            reply_record = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "review_id": review_id,
                "reply_text": reply_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "posted"
            }
            
            await db.review_replies.insert_one(reply_record)
            
            return {
                "success": True,
                "message": "Reply posted successfully to Google!"
            }
            
        except Exception as google_error:
            logger.error(f"Google API error posting review reply: {str(google_error)}")
            
            # Fallback: Save to database
            reply_record = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "review_id": review_id,
                "reply_text": reply_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "failed_to_post",
                "error": str(google_error)
            }
            
            await db.review_replies.insert_one(reply_record)
            
            return {
                "success": True,
                "message": "Reply saved locally. Google API connection issue - please check your Google Business Profile connection.",
                "warning": str(google_error)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error posting review reply: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to post reply: {str(e)}")

@api_router.post("/review/generate")
async def generate_review(input: ReviewGenerate):
    """
    Generate AI review using OpenAI API directly
    Model: gpt-5-nano
    """
    # Get API key and model
    api_key = os.environ.get('OPENAI_API_KEY')
    model = os.environ.get('OPENAI_MODEL', 'gpt-5-nano')
    
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    # Count keywords for word limit
    keyword_list = [k.strip() for k in input.keywords.split() if k.strip()]
    keyword_count = len(keyword_list)
    word_limit = "50 words" if keyword_count > 8 else "30-40 words"
    
    # System message with instructions
    system_message = f"""You are an AI assistant that generates Google business reviews.

Instructions:
1. User provides keywords or short phrases.
2. User selects sentiment: {input.sentiment}.
3. Generate a short, natural-sounding review based on the keywords and sentiment.
4. Include all keywords naturally.
5. Word limits: Max {word_limit}.
6. Do NOT include emojis.
7. Do NOT mention AI or that it was generated automatically.
8. Output only the review text in {input.language} language, nothing else."""
    
    # User message with prompt
    user_message = f"""User Input:
Keywords: {input.keywords}
Sentiment: {input.sentiment}
Language: {input.language}
Business: {input.business_name}

Generate the review now."""
    
    # Call OpenAI API
    try:
        # Build request payload
        request_payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        }
        
        # Add parameters based on model
        if "gpt-5-nano" in model:
            # gpt-5-nano specific parameters - only supports max_completion_tokens and default temperature
            request_payload["max_completion_tokens"] = 150
            # Note: gpt-5-nano only supports default temperature (1), so we don't set it
        else:
            # Standard models
            request_payload["max_completion_tokens"] = 100
            request_payload["temperature"] = 0.7
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=request_payload,
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_detail = response.json().get('error', {}).get('message', 'Unknown error')
                logger.error(f"OpenAI API error: {error_detail}")
                raise HTTPException(status_code=500, detail=f"AI service error: {error_detail}")
            
            result = response.json()
            generated_review = result["choices"][0]["message"]["content"].strip()
            
            return {"generated_review": generated_review}
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timeout. Please try again.")
    except Exception as e:
        logger.error(f"Review generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate review: {str(e)}")

@api_router.post("/review/submit", response_model=Review)
async def submit_review(input: ReviewSubmit, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please login with Google to submit review")
    
    # Verify business exists
    business = await db.businesses.find_one({"id": input.business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if user has already reviewed this business
    existing_review = await db.reviews.find_one({
        "business_id": input.business_id,
        "customer_email": user.email
    }, {"_id": 0})
    
    if existing_review:
        raise HTTPException(
            status_code=400, 
            detail="You have already submitted a review for this business. Only one review per customer is allowed."
        )
    
    # Create review
    review = Review(
        business_id=input.business_id,
        customer_email=user.email,
        customer_name=user.name,
        rating=input.rating,
        keywords=input.keywords,
        generated_review=input.generated_review,
        posted_to_google=False  # Will be implemented with GMB API
    )
    
    review_doc = review.model_dump()
    review_doc['created_at'] = review_doc['created_at'].isoformat()
    
    await db.reviews.insert_one(review_doc)
    
    return review

@api_router.get("/business/{business_id}/reviews", response_model=List[Review])
async def get_business_reviews(business_id: str):
    reviews = await db.reviews.find({"business_id": business_id}, {"_id": 0}).to_list(1000)
    
    for review in reviews:
        if isinstance(review.get('created_at'), str):
            review['created_at'] = datetime.fromisoformat(review['created_at'])
    
    return reviews

# Support Tickets
@api_router.post("/tickets/create")
async def create_ticket(ticket_data: dict):
    """Create support ticket from business"""
    from admin_models import SupportTicket, TicketStatus, TicketPriority, Notification, NotificationType
    
    # Get business details
    business = await db.businesses.find_one({"id": ticket_data['business_id']}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    ticket = SupportTicket(
        business_id=ticket_data['business_id'],
        business_name=business.get('name', 'Unknown'),
        business_email=business.get('owner_email') or business.get('email', ''),
        subject=ticket_data['subject'],
        description=ticket_data['description'],
        priority=ticket_data.get('priority', 'medium'),
        status=TicketStatus.OPEN
    )
    
    ticket_doc = ticket.model_dump()
    ticket_doc['created_at'] = ticket_doc['created_at'].isoformat()
    ticket_doc['updated_at'] = ticket_doc['updated_at'].isoformat()
    
    await db.support_tickets.insert_one(ticket_doc)
    
    # Create notification for admin
    notification = Notification(
        type=NotificationType.SUPPORT_TICKET,
        title=f"New Support Ticket: {ticket_data['subject']}",
        message=f"From {business.get('name', 'Unknown')} - {ticket_data['description'][:100]}",
        priority="high",
        related_id=ticket.id
    )
    
    notif_doc = notification.model_dump()
    notif_doc['created_at'] = notif_doc['created_at'].isoformat()
    await db.notifications.insert_one(notif_doc)
    
    return {"success": True, "ticket_id": ticket.id, "message": "Support ticket created successfully"}

@api_router.get("/tickets/{business_id}")
async def get_business_tickets(business_id: str):
    """Get all tickets for a business"""
    tickets = await db.support_tickets.find(
        {"business_id": business_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"tickets": tickets}

app.include_router(api_router)
app.include_router(payment_router)  # Include subscription/payment routes

# Import admin routes
from admin_routes import admin_router
app.include_router(admin_router)  # Include admin panel routes

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
