#!/usr/bin/env python3
"""
Create default admin user for Revio Admin Panel
Email: admin@test.com
Password: Test@1234
"""

import asyncio
import bcrypt
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_default_admin():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if admin already exists
    existing = await db.admins.find_one({"email": "admin@test.com"})
    
    if existing:
        print("✓ Admin user already exists: admin@test.com")
        return
    
    # Create password hash
    password = "Test@1234"
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin
    admin = {
        "id": str(uuid.uuid4()),
        "email": "admin@test.com",
        "password_hash": password_hash,
        "name": "Admin User",
        "role": "super_admin",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.admins.insert_one(admin)
    
    print("✅ Default admin user created!")
    print("📧 Email: admin@test.com")
    print("🔑 Password: Test@1234")
    print("🔗 Login at: /admin/login")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_default_admin())
