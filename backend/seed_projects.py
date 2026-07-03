#!/usr/bin/env python3
"""
Seed script to add sample projects for testing.
Run this after seeding test users.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'word_up_db')]

ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development').lower()
if ENVIRONMENT in ('production', 'prod') and os.environ.get('ALLOW_SEED') != '1':
    print('Refusing to seed projects in a production environment. '
          'Set ALLOW_SEED=1 to override.')
    sys.exit(1)

# Set SEED_RESET=1 to wipe existing projects before inserting the samples.
RESET = os.environ.get('SEED_RESET') == '1'

async def seed_projects():
    # Get business users
    business_user = await db.users.find_one({'user_type': 'business'})
    
    if not business_user:
        print("No business user found. Please run seed_test_users.py first.")
        return
    
    business_id = business_user['id']
    
    sample_projects = [
        {
            'id': str(uuid.uuid4()),
            'business_user_id': business_id,
            'title': 'Blog Content Writer Needed',
            'description': 'Looking for an experienced blog writer to create engaging tech content. We need 4 articles per month, each around 1500 words. Topics will revolve around AI, software development, and tech trends.',
            'genre': 'Technical',
            'budget_range': '$500-$800/month',
            'deadline': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            'status': 'open',
            'created_at': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': str(uuid.uuid4()),
            'business_user_id': business_id,
            'title': 'Short Story for Marketing Campaign',
            'description': 'We\'re launching a new product and need a creative short story (2000-3000 words) that subtly features our brand. Looking for fiction writers with a flair for engaging narratives.',
            'genre': 'Fiction',
            'budget_range': '$300-$500',
            'deadline': (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            'status': 'open',
            'created_at': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': str(uuid.uuid4()),
            'business_user_id': business_id,
            'title': 'Screenplay for Product Demo Video',
            'description': 'Need a screenplay writer for a 5-minute product demonstration video. Should be engaging, clear, and highlight key features of our SaaS platform.',
            'genre': 'Screenplay',
            'budget_range': '$400-$600',
            'deadline': (datetime.now(timezone.utc) + timedelta(days=21)).isoformat(),
            'status': 'open',
            'created_at': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': str(uuid.uuid4()),
            'business_user_id': business_id,
            'title': 'Copywriter for Landing Pages',
            'description': 'Looking for a copywriter to create compelling content for 5 landing pages. Experience with conversion-focused writing is essential. Each page needs headlines, body copy, and CTAs.',
            'genre': 'Marketing',
            'budget_range': '$200-$400',
            'deadline': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            'status': 'open',
            'created_at': datetime.now(timezone.utc).isoformat()
        },
        {
            'id': str(uuid.uuid4()),
            'business_user_id': business_id,
            'title': 'E-book Writer - Personal Finance',
            'description': 'We need a non-fiction writer to create a 50-page e-book on personal finance for millennials. Topics should include budgeting, investing, and debt management. Research skills required.',
            'genre': 'Non-Fiction',
            'budget_range': '$1000-$1500',
            'deadline': (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
            'status': 'open',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Only wipe existing projects when explicitly requested.
    if RESET:
        await db.projects.delete_many({})
        print("Cleared existing projects (SEED_RESET=1)")

    # Insert sample projects (skip titles that already exist for this business).
    for project in sample_projects:
        exists = await db.projects.find_one(
            {'business_user_id': business_id, 'title': project['title']}
        )
        if exists:
            print(f"Skipping existing project: {project['title']}")
            continue
        await db.projects.insert_one(project)
        print(f"Created project: {project['title']}")
    
    print(f"\n✅ Successfully created {len(sample_projects)} sample projects!")
    print("\nProjects are now available for writers to apply to.")

if __name__ == "__main__":
    asyncio.run(seed_projects())
