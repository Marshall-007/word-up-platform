"""
Seed script to add test users to the database.
Run this script with: python seed_test_users.py
"""
import asyncio
import bcrypt
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_test_users():
    """Create test users for the platform."""
    
    print("🌱 Seeding test users...")
    
    # Test users configuration
    test_users = [
        {
            "email": "writer@test.com",
            "name": "Sarah Writer",
            "password": "password123",
            "user_type": "creative",
            "location": "Los Angeles, CA",
            "bio": "Experienced screenwriter with a passion for sci-fi and drama.",
            "genres": ["Sci-Fi", "Drama", "Thriller"],
            "experience_level": "professional",
            "languages": ["English", "Spanish"]
        },
        {
            "email": "author@test.com",
            "name": "John Author",
            "password": "password123",
            "user_type": "creative",
            "location": "New York, NY",
            "bio": "Award-winning novelist specializing in historical fiction.",
            "genres": ["Historical Fiction", "Mystery", "Romance"],
            "experience_level": "professional",
            "languages": ["English", "French"]
        },
        {
            "email": "newwriter@test.com",
            "name": "Emma Novice",
            "password": "password123",
            "user_type": "creative",
            "location": "Chicago, IL",
            "bio": "Aspiring writer looking to break into the industry.",
            "genres": ["Fantasy", "Young Adult"],
            "experience_level": "novice",
            "languages": ["English"]
        },
        {
            "email": "business@test.com",
            "name": "Production Studios Inc",
            "password": "password123",
            "user_type": "business",
            "company_name": "Production Studios Inc",
            "industry": "Film & Television",
            "looking_for": "Screenwriters for upcoming film projects"
        },
        {
            "email": "publisher@test.com",
            "name": "Book Publishing House",
            "password": "password123",
            "user_type": "business",
            "company_name": "Book Publishing House",
            "industry": "Publishing",
            "looking_for": "Fiction authors for new anthology series"
        }
    ]
    
    created_count = 0
    skipped_count = 0
    
    for user_data in test_users:
        # Check if user already exists
        existing = await db.users.find_one({'email': user_data['email']})
        if existing:
            print(f"⚠️  User {user_data['email']} already exists, skipping...")
            skipped_count += 1
            continue
        
        # Create user
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": user_data['email'],
            "name": user_data['name'],
            "user_type": user_data['user_type'],
            "password_hash": hash_password(user_data['password']),
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user)
        print(f"✅ Created user: {user_data['email']} ({user_data['user_type']})")
        
        # Create profile based on user type
        if user_data['user_type'] == 'creative':
            profile = {
                "user_id": user_id,
                "bio": user_data.get('bio', ''),
                "genres": user_data.get('genres', []),
                "experience_level": user_data.get('experience_level', 'novice'),
                "location": user_data.get('location', ''),
                "languages": user_data.get('languages', []),
                "portfolio_links": [],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.writer_profiles.insert_one(profile)
            print(f"   📝 Created writer profile for {user_data['name']}")
            
            # Add a sample writing piece for writers
            sample = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": f"Sample Work by {user_data['name']}",
                "content": "This is a sample of my writing work. In a world where imagination knows no bounds...",
                "genre": user_data.get('genres', ['General'])[0],
                "format": "short_story",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.writing_samples.insert_one(sample)
            print(f"   📚 Added writing sample for {user_data['name']}")
            
        else:  # business
            profile = {
                "user_id": user_id,
                "company_name": user_data.get('company_name', user_data['name']),
                "industry": user_data.get('industry', ''),
                "website": "",
                "description": "",
                "looking_for": user_data.get('looking_for', ''),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.business_profiles.insert_one(profile)
            print(f"   🏢 Created business profile for {user_data['name']}")
        
        created_count += 1
    
    print(f"\n✨ Seeding complete!")
    print(f"   Created: {created_count} users")
    print(f"   Skipped: {skipped_count} users (already exist)")
    print(f"\n📋 Test Login Credentials:")
    print(f"   Writers:")
    print(f"     • writer@test.com / password123 (Professional)")
    print(f"     • author@test.com / password123 (Professional)")
    print(f"     • newwriter@test.com / password123 (Novice)")
    print(f"   Businesses:")
    print(f"     • business@test.com / password123")
    print(f"     • publisher@test.com / password123")

if __name__ == "__main__":
    asyncio.run(seed_test_users())
