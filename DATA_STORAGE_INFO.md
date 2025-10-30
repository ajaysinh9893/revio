# Data Storage Information

## What Data We Store

### 1. **User Data** (MongoDB Collection: `users`)
When a customer signs in with Google to submit a review, we store:
- **User ID** (from Google OAuth)
- **Email** (from Google account)
- **Name** (from Google account)
- **Profile Picture URL** (from Google account)
- **Created At** (timestamp)

**Purpose**: To identify users and prevent duplicate reviews.

**Data Source**: Google OAuth (Emergent Auth Service)

---

### 2. **User Sessions** (MongoDB Collection: `user_sessions`)
For authentication management:
- **User ID** (reference to user)
- **Session Token** (for authentication)
- **Expires At** (7 days from creation)
- **Created At** (timestamp)

**Purpose**: Keep users logged in securely for 7 days.

**Auto-Cleanup**: Sessions expire automatically after 7 days.

---

### 3. **Business Data** (MongoDB Collection: `businesses`)
Business owner information:
- **Business ID** (unique identifier)
- **Business Name**
- **Google Place ID**
- **Owner Email**
- **QR Code URL**
- **Verification Status**
- **Subscription Details**:
  - Subscription Status (trial/active/expired)
  - Trial End Date
  - Subscription Expiry Date
  - Payment ID
  - Auto-renewal Status
- **Created At** (timestamp)

**Purpose**: Manage business accounts and subscriptions.

---

### 4. **Review Data** (MongoDB Collection: `reviews`)
Customer reviews:
- **Review ID** (unique identifier)
- **Business ID** (which business was reviewed)
- **Customer Email** (who submitted the review)
- **Customer Name**
- **Rating** (1-5 stars)
- **Keywords** (customer input)
- **Generated Review** (AI-generated text)
- **Posted to Google** (boolean - future feature)
- **Created At** (timestamp)

**Purpose**: Store reviews and prevent duplicate submissions.

**Limitation**: One review per customer per business (same as Google Reviews).

---

## Privacy & Security

### Google Reviews Terms Compliance
- ✅ One review per user per business
- ✅ User must be logged in with Google account
- ✅ User email is verified through Google OAuth
- ✅ Reviews are timestamped
- ✅ User can see their submission confirmation

### Data Protection
- User passwords are **NEVER** stored (Google OAuth handles authentication)
- Session tokens are encrypted and expire after 7 days
- All API endpoints require proper authentication
- CORS is properly configured for security

### Data Access
- Business owners can only see reviews for their own business
- Customers can only submit reviews when authenticated
- User profile data (from Google) is only used for identification

---

## GDPR & Privacy Compliance

### User Rights
Users have the right to:
1. **Access**: View their submitted reviews
2. **Deletion**: Request deletion of their reviews and account data
3. **Rectification**: Update their review (not yet implemented - following Google's one-review policy)

### Data Retention
- **User Data**: Stored as long as account is active
- **Sessions**: Auto-deleted after 7 days
- **Reviews**: Stored permanently (or until user requests deletion)
- **Business Data**: Stored as long as subscription is active

---

## Database: MongoDB

**Database Name**: `review_system_db`

**Collections**:
1. `users` - User accounts from Google OAuth
2. `user_sessions` - Authentication sessions
3. `businesses` - Business registrations
4. `reviews` - Customer reviews

**Connection**: Local MongoDB instance (mongodb://localhost:27017)

---

## Summary

**Yes, we store user data**, but only what's necessary:
- Google account info (email, name, picture) for identification
- Reviews submitted by users
- Business information
- Session data for authentication (temporary)

**We DO NOT store**:
- Passwords (Google handles authentication)
- Payment card details (Razorpay handles payments)
- Browsing history
- Device information
- Location data

All data storage follows Google Reviews terms and standard privacy practices.
