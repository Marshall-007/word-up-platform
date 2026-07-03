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
            "looking_for": "Screenwriters for upcoming film projects",
            "projects": [
                {
                    "title": "Sci-Fi Feature Film Screenplay",
                    "description": "We're looking for a talented screenwriter to develop an original sci-fi screenplay. The story explores first contact with an alien civilization through the eyes of a small-town family. Budget includes development and two rounds of revisions. Experience with produced scripts preferred.",
                    "genre": "Sci-Fi",
                    "budget_range": "$5,000 - $15,000"
                },
                {
                    "title": "Drama Series Pilot Script",
                    "description": "Seeking a writer for a 60-minute drama pilot set in 1970s Johannesburg. The series follows a jazz musician navigating apartheid-era South Africa. We need authentic voices and deep understanding of the era. This is a passion project with a major streaming platform interested.",
                    "genre": "Drama",
                    "budget_range": "$3,000 - $8,000"
                },
                {
                    "title": "Short Film Collection - African Folklore",
                    "description": "Looking for writers to contribute short film scripts (10-15 min each) based on African folklore and mythology. We want modern retellings that honor traditional stories. Open to writers of all experience levels with a passion for storytelling.",
                    "genre": "Fantasy",
                    "budget_range": "$500 - $2,000 per script"
                }
            ]
        },
        {
            "email": "publisher@test.com",
            "name": "Book Publishing House",
            "password": "password123",
            "user_type": "business",
            "company_name": "Book Publishing House",
            "industry": "Publishing",
            "looking_for": "Fiction authors for new anthology series",
            "projects": [
                {
                    "title": "Historical Fiction Anthology - Untold Stories",
                    "description": "We're compiling an anthology of historical fiction stories (5,000-10,000 words each) that shed light on lesser-known historical events. Looking for compelling narratives with strong research backing. Authors retain rights for future expansion into full novels.",
                    "genre": "Historical Fiction",
                    "budget_range": "$1,000 - $3,000 per story"
                },
                {
                    "title": "Young Adult Fantasy Novel",
                    "description": "Seeking an author for a YA fantasy novel (60,000-80,000 words). The story should feature a diverse protagonist and incorporate elements of African mythology. This is for our new imprint focused on diverse fantasy voices. Full publishing support provided.",
                    "genre": "Fantasy",
                    "budget_range": "$8,000 - $20,000"
                },
                {
                    "title": "Blog Content Writer - Literary Reviews",
                    "description": "Looking for a consistent blog writer to produce weekly literary reviews and author interviews for our publisher website. Must have a strong voice, wide reading habit, and ability to meet weekly deadlines. 800-1,200 words per article.",
                    "genre": "Non-Fiction",
                    "budget_range": "$200 - $500 per article"
                }
            ]
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
                "description": user_data.get('looking_for', ''),
                "credits": 10,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.business_profiles.insert_one(profile)
            print(f"   🏢 Created business profile for {user_data['name']}")
            
            # Create sample projects for each business
            for proj_data in user_data.get('projects', []):
                project_id = str(uuid.uuid4())
                project = {
                    "id": project_id,
                    "business_user_id": user_id,
                    "title": proj_data['title'],
                    "description": proj_data['description'],
                    "genre": proj_data['genre'],
                    "budget_range": proj_data.get('budget_range', ''),
                    "deadline": None,
                    "status": "open",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.projects.insert_one(project)
                print(f"   📋 Created project: {proj_data['title']}")
        
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
