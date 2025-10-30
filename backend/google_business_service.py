from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
import logging

logger = logging.getLogger(__name__)

class GoogleBusinessService:
    """Service for interacting with Google My Business API"""
    
    SCOPES = ['https://www.googleapis.com/auth/business.manage']
    
    def __init__(self):
        self.client_id = os.environ.get('GOOGLE_CLIENT_ID')
        self.client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI')
    
    def get_authorization_url(self, state: str):
        """Generate OAuth authorization URL"""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return authorization_url, state
    
    def exchange_code_for_tokens(self, code: str):
        """Exchange authorization code for access and refresh tokens"""
        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self.redirect_uri]
                    }
                },
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            return {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "expires_at": credentials.expiry.isoformat() if credentials.expiry else None
            }
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
            raise
    
    def get_business_accounts(self, access_token: str):
        """Fetch all business accounts for the authenticated user"""
        try:
            credentials = Credentials(token=access_token)
            service = build('mybusinessaccountmanagement', 'v1', credentials=credentials)
            
            # List accounts
            accounts_response = service.accounts().list().execute()
            accounts = accounts_response.get('accounts', [])
            
            return accounts
        except HttpError as e:
            logger.error(f"HTTP Error fetching accounts: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error fetching accounts: {str(e)}")
            raise
    
    def get_business_locations(self, access_token: str, account_name: str):
        """Fetch all locations for a specific business account"""
        try:
            credentials = Credentials(token=access_token)
            service = build('mybusinessbusinessinformation', 'v1', credentials=credentials)
            
            # List locations
            parent = account_name
            locations_response = service.accounts().locations().list(parent=parent, readMask='name,title,storefrontAddress,phoneNumbers').execute()
            locations = locations_response.get('locations', [])
            
            return locations
        except HttpError as e:
            logger.error(f"HTTP Error fetching locations: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error fetching locations: {str(e)}")
            raise
    
    def get_location_reviews(self, access_token: str, location_name: str, page_size: int = 50):
        """Fetch reviews for a specific location"""
        try:
            credentials = Credentials(token=access_token)
            service = build('mybusiness', 'v4', credentials=credentials)
            
            # Fetch reviews
            reviews_response = service.accounts().locations().reviews().list(
                parent=location_name,
                pageSize=page_size
            ).execute()
            
            reviews = reviews_response.get('reviews', [])
            average_rating = reviews_response.get('averageRating', 0)
            total_review_count = reviews_response.get('totalReviewCount', 0)
            
            # Process reviews to extract actionable data
            processed_reviews = []
            for review in reviews:
                star_rating = self._parse_star_rating(review.get('starRating'))
                processed_reviews.append({
                    'review_id': review.get('reviewId', ''),
                    'reviewer_name': review.get('reviewer', {}).get('displayName', 'Anonymous'),
                    'reviewer_profile_photo': review.get('reviewer', {}).get('profilePhotoUrl', ''),
                    'rating': star_rating,
                    'comment': review.get('comment', '')[:200],  # Limit to 200 chars
                    'create_time': review.get('createTime', ''),
                    'update_time': review.get('updateTime', ''),
                    'reply_comment': review.get('reviewReply', {}).get('comment', None),
                    'reply_time': review.get('reviewReply', {}).get('updateTime', None),
                    'has_reply': bool(review.get('reviewReply'))
                })
            
            return {
                'reviews': processed_reviews,
                'average_rating': average_rating,
                'total_review_count': total_review_count
            }
        except HttpError as e:
            if e.resp.status == 403:
                logger.error("Access denied. Make sure the Google My Business API is enabled and you have proper permissions.")
            logger.error(f"HTTP Error fetching reviews: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error fetching reviews: {str(e)}")
            raise
    
    def _parse_star_rating(self, star_rating_str):
        """Convert Google's star rating enum to number"""
        rating_map = {
            'ONE': 1,
            'TWO': 2,
            'THREE': 3,
            'FOUR': 4,
            'FIVE': 5
        }
        return rating_map.get(star_rating_str, 0)
    
    def extract_keywords(self, reviews_data):
        """Extract top positive and negative keywords from reviews"""
        import re
        from collections import Counter
        
        positive_keywords = []
        negative_keywords = []
        
        # Common positive and negative words
        positive_words = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'good', 'best', 
                         'love', 'perfect', 'awesome', 'delicious', 'friendly', 'clean', 'fresh',
                         'helpful', 'nice', 'tasty', 'quick', 'fast', 'beautiful']
        negative_words = ['bad', 'terrible', 'awful', 'poor', 'worst', 'slow', 'dirty', 'rude',
                         'expensive', 'disappointing', 'cold', 'stale', 'unfriendly', 'unhelpful',
                         'late', 'wrong', 'horrible', 'disgusting', 'overpriced']
        
        for review in reviews_data:
            if not review.get('comment'):
                continue
                
            comment = review['comment'].lower()
            words = re.findall(r'\b\w+\b', comment)
            rating = review.get('rating', 0)
            
            for word in words:
                if word in positive_words and rating >= 4:
                    positive_keywords.append(word)
                elif word in negative_words and rating <= 2:
                    negative_keywords.append(word)
        
        # Count and get top keywords
        positive_counter = Counter(positive_keywords)
        negative_counter = Counter(negative_keywords)
        
        return {
            'positive': [{'word': word, 'count': count} for word, count in positive_counter.most_common(10)],
            'negative': [{'word': word, 'count': count} for word, count in negative_counter.most_common(10)]
        }
    
    def refresh_access_token(self, refresh_token: str):
        """Refresh an expired access token using refresh token"""
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            
            # Trigger refresh
            from google.auth.transport.requests import Request
            credentials.refresh(Request())
            
            return {
                "access_token": credentials.token,
                "expires_at": credentials.expiry.isoformat() if credentials.expiry else None
            }
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            raise
