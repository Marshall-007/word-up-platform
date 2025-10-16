from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', 7))

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    user_type: str  # 'creative' or 'business'
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WriterProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    bio: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    experience_level: Optional[str] = None  # 'novice', 'intermediate', 'professional'
    location: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    portfolio_links: List[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WritingSample(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str
    genre: str
    format: str  # 'screenplay', 'novel', 'blog', 'marketing', 'short_story'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusinessProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    company_name: str
    industry: str
    description: Optional[str] = None
    website: Optional[str] = None
    credits: int = Field(default=10)  # Starting credits
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_user_id: str
    title: str
    description: str
    genre: str
    budget_range: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str = Field(default='open')  # 'open', 'in_progress', 'completed'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ REQUEST/RESPONSE MODELS ============

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    user_type: str
    location: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

class SessionDataRequest(BaseModel):
    session_id: str

class AIRequest(BaseModel):
    text: str
    task: str  # 'grammar', 'rewrite', 'tone_adjust', 'logline'
    tone: Optional[str] = None

class WritingSampleCreate(BaseModel):
    title: str
    content: str
    genre: str
    format: str

class WriterProfileUpdate(BaseModel):
    bio: Optional[str] = None
    genres: Optional[List[str]] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    languages: Optional[List[str]] = None
    portfolio_links: Optional[List[str]] = None

class BusinessProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None

class ProjectCreate(BaseModel):
    title: str
    description: str
    genre: str
    budget_range: Optional[str] = None
    deadline: Optional[datetime] = None

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get('user_id')
    except:
        return None

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    # First check for session_token cookie (Emergent Auth)
    session_token = request.cookies.get('session_token')
    
    if session_token:
        session = await db.user_sessions.find_one({'session_token': session_token})
        if session and session['expires_at'] > datetime.now(timezone.utc):
            user = await db.users.find_one({'id': session['user_id']}, {'_id': 0, 'password_hash': 0})
            if user:
                return User(**user)
    
    # Fall back to Authorization header (JWT)
    if credentials:
        token = credentials.credentials
        user_id = verify_jwt_token(token)
        if user_id:
            user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
            if user:
                return User(**user)
    
    raise HTTPException(status_code=401, detail='Not authenticated')

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    # Check if user exists
    existing = await db.users.find_one({'email': req.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user = User(
        email=req.email,
        name=req.name,
        user_type=req.user_type,
        password_hash=hash_password(req.password)
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Create profile based on user type
    if req.user_type == 'creative':
        profile = WriterProfile(user_id=user.id, location=req.location or '')
        profile_dict = profile.model_dump()
        profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
        await db.writer_profiles.insert_one(profile_dict)
    else:
        profile = BusinessProfile(user_id=user.id, company_name=req.name, industry='')
        profile_dict = profile.model_dump()
        profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
        await db.business_profiles.insert_one(profile_dict)
    
    token = create_jwt_token(user.id)
    user_dict.pop('password_hash', None)
    user_dict.pop('_id', None)  # Remove MongoDB ObjectId if present
    return AuthResponse(token=token, user=user_dict)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({'email': req.email})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_jwt_token(user['id'])
    user.pop('_id', None)
    user.pop('password_hash', None)
    return AuthResponse(token=token, user=user)

@api_router.get("/auth/session-data")
async def get_session_data(response: Response, x_session_id: str = Header(...)):
    # Call Emergent auth service
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': x_session_id}
        ) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=401, detail='Invalid session')
            data = await resp.json()
    
    # Check if user exists, create if not
    user = await db.users.find_one({'email': data['email']})
    if not user:
        # Create new user with Google auth
        new_user = User(
            email=data['email'],
            name=data['name'],
            user_type='creative',  # Default, can be changed later
            picture=data.get('picture')
        )
        user_dict = new_user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        
        # Create default writer profile
        profile = WriterProfile(user_id=new_user.id)
        profile_dict = profile.model_dump()
        profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
        await db.writer_profiles.insert_one(profile_dict)
        
        user = user_dict
    
    # Create session
    session_token = data['session_token']
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = UserSession(
        user_id=user['id'],
        session_token=session_token,
        expires_at=expires_at
    )
    session_dict = session.model_dump()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    
    await db.user_sessions.insert_one(session_dict)
    
    # Set cookie
    response.set_cookie(
        key='session_token',
        value=session_token,
        httponly=True,
        secure=True,
        samesite='none',
        path='/'
    )
    
    user.pop('_id', None)
    user.pop('password_hash', None)
    return user

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(response: Response, user: User = Depends(get_current_user), request: Request = None):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_one({'session_token': session_token})
    response.delete_cookie('session_token', path='/')
    return {'message': 'Logged out'}

# ============ WRITER ROUTES ============

@api_router.get("/writers/profile")
async def get_writer_profile(user: User = Depends(get_current_user)):
    profile = await db.writer_profiles.find_one({'user_id': user.id}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=404, detail='Profile not found')
    return profile

@api_router.put("/writers/profile")
async def update_writer_profile(updates: WriterProfileUpdate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can update writer profile')
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.writer_profiles.update_one(
        {'user_id': user.id},
        {'$set': update_dict},
        upsert=True
    )
    
    profile = await db.writer_profiles.find_one({'user_id': user.id}, {'_id': 0})
    return profile

@api_router.post("/writers/samples")
async def create_sample(sample: WritingSampleCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can upload samples')
    
    # Check sample count
    count = await db.writing_samples.count_documents({'user_id': user.id})
    if count >= 2:
        raise HTTPException(status_code=400, detail='Maximum 2 samples allowed')
    
    new_sample = WritingSample(
        user_id=user.id,
        title=sample.title,
        content=sample.content,
        genre=sample.genre,
        format=sample.format
    )
    
    sample_dict = new_sample.model_dump()
    sample_dict['created_at'] = sample_dict['created_at'].isoformat()
    await db.writing_samples.insert_one(sample_dict)
    
    return new_sample

@api_router.get("/writers/samples")
async def get_samples(user: User = Depends(get_current_user)):
    samples = await db.writing_samples.find({'user_id': user.id}, {'_id': 0}).to_list(100)
    return samples

@api_router.delete("/writers/samples/{sample_id}")
async def delete_sample(sample_id: str, user: User = Depends(get_current_user)):
    result = await db.writing_samples.delete_one({'id': sample_id, 'user_id': user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Sample not found')
    return {'message': 'Sample deleted'}

@api_router.get("/writers/discover")
async def discover_writers(user: User = Depends(get_current_user), genre: Optional[str] = None, skip: int = 0, limit: int = 20):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can discover writers')
    
    # Get all creative users
    query = {'user_type': 'creative'}
    users = await db.users.find(query, {'_id': 0, 'password_hash': 0}).skip(skip).limit(limit).to_list(100)
    
    # Enrich with profiles and samples
    results = []
    for u in users:
        profile = await db.writer_profiles.find_one({'user_id': u['id']}, {'_id': 0})
        samples = await db.writing_samples.find({'user_id': u['id']}, {'_id': 0}).to_list(2)
        
        # Filter by genre if specified
        if genre and profile:
            if genre not in profile.get('genres', []):
                continue
        
        results.append({
            'user': u,
            'profile': profile,
            'samples': samples
        })
    
    return results

# ============ BUSINESS ROUTES ============

@api_router.get("/business/profile")
async def get_business_profile(user: User = Depends(get_current_user)):
    profile = await db.business_profiles.find_one({'user_id': user.id}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=404, detail='Profile not found')
    return profile

@api_router.put("/business/profile")
async def update_business_profile(updates: BusinessProfileUpdate, user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can update business profile')
    
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.business_profiles.update_one(
        {'user_id': user.id},
        {'$set': update_dict},
        upsert=True
    )
    
    profile = await db.business_profiles.find_one({'user_id': user.id}, {'_id': 0})
    return profile

@api_router.get("/business/credits")
async def get_credits(user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users have credits')
    
    profile = await db.business_profiles.find_one({'user_id': user.id}, {'_id': 0})
    if not profile:
        return {'credits': 0}
    return {'credits': profile.get('credits', 0)}

@api_router.post("/business/projects")
async def create_project(project: ProjectCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can post projects')
    
    new_project = Project(
        business_user_id=user.id,
        title=project.title,
        description=project.description,
        genre=project.genre,
        budget_range=project.budget_range,
        deadline=project.deadline
    )
    
    project_dict = new_project.model_dump()
    project_dict['created_at'] = project_dict['created_at'].isoformat()
    if project_dict['deadline']:
        project_dict['deadline'] = project_dict['deadline'].isoformat()
    
    await db.projects.insert_one(project_dict)
    return new_project

@api_router.get("/business/projects")
async def get_business_projects(user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can view their projects')
    
    projects = await db.projects.find({'business_user_id': user.id}, {'_id': 0}).to_list(100)
    return projects

@api_router.get("/projects")
async def get_all_projects(user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    projects = await db.projects.find({}, {'_id': 0}).skip(skip).limit(limit).to_list(100)
    return projects

# ============ AI ROUTES ============

@api_router.post("/ai/assist")
async def ai_assist(req: AIRequest, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='AI tools are for creative users')
    
    # Initialize LLM
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"ai_assist_{user.id}_{datetime.now().timestamp()}",
        system_message="You are a professional writing assistant helping authors improve their work."
    ).with_model("openai", "gpt-4o")
    
    # Create prompt based on task
    prompts = {
        'grammar': f"Check and correct the grammar in the following text. Return only the corrected version:\n\n{req.text}",
        'rewrite': f"Rewrite the following text to make it more engaging and polished:\n\n{req.text}",
        'tone_adjust': f"Adjust the tone of the following text to be {req.tone or 'professional'}:\n\n{req.text}",
        'logline': f"Create a compelling logline or synopsis for the following story:\n\n{req.text}"
    }
    
    prompt = prompts.get(req.task, req.text)
    message = UserMessage(text=prompt)
    
    response = await chat.send_message(message)
    return {'result': response}

# ============ STARTUP & MIDDLEWARE ============

app.include_router(api_router)

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