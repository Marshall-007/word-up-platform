from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Response, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import aiofiles
# from emergentintegrations.llm.chat import LlmChat, UserMessage  # Temporarily disabled

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
SESSION_EXPIRATION_SECONDS = JWT_EXPIRATION_DAYS * 24 * 60 * 60

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
    user_type: Literal['creative', 'business']
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
    pdf_url: Optional[str] = None  # URL to the uploaded PDF
    pdf_filename: Optional[str] = None  # Original filename
    pdf_size: Optional[int] = None  # File size in bytes
    price_credits: Optional[int] = None  # Price in credits (None = free preview)
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
    status: Literal['open', 'in_progress', 'completed'] = Field(default='open')
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Application(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    writer_user_id: str
    cover_letter: Optional[str] = None
    status: Literal['pending', 'accepted', 'rejected'] = Field(default='pending')
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_user_id: str
    writer_user_id: str
    sample_id: str
    credits_spent: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ REQUEST/RESPONSE MODELS ============

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    user_type: Literal['creative', 'business']
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
    price_credits: Optional[int] = None  # Price in credits for businesses to purchase

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

class ApplicationCreate(BaseModel):
    project_id: str
    cover_letter: Optional[str] = None

class ApplicationUpdate(BaseModel):
    status: Literal['accepted', 'rejected']

class ProjectUpdateRequest(BaseModel):
    status: Optional[Literal['open', 'in_progress', 'completed']] = None
    title: Optional[str] = None
    description: Optional[str] = None

class PurchaseSampleRequest(BaseModel):
    sample_id: str

class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth - allows user to choose their type"""
    session_id: str
    user_type: Literal['creative', 'business'] = 'creative'

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SettingsUpdateRequest(BaseModel):
    emailNotifications: Optional[bool] = None
    pushNotifications: Optional[bool] = None
    marketingEmails: Optional[bool] = None
    profileVisibility: Optional[bool] = None
    showEmail: Optional[bool] = None
    darkMode: Optional[bool] = None
    language: Optional[str] = None
    autoRespond: Optional[bool] = None
    jobAlerts: Optional[bool] = None

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
    except jwt.InvalidTokenError:
        return None


def validate_sample_price(price_credits: Optional[int]) -> Optional[int]:
    if price_credits is not None and price_credits < 1:
        raise HTTPException(status_code=400, detail='Sample price must be at least 1 credit')
    return price_credits


def resolve_sample_cost(price_credits: Optional[int]) -> int:
    # Defensive fallback so malformed legacy records cannot create negative-cost purchases.
    if isinstance(price_credits, int) and price_credits > 0:
        return price_credits
    return 1


def normalize_email(email: str) -> str:
    return email.strip().lower()


def parse_stored_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def is_https_request(request: Request) -> bool:
    forwarded_proto = request.headers.get('x-forwarded-proto', '').split(',')[0].strip().lower()
    if forwarded_proto:
        return forwarded_proto == 'https'
    return request.url.scheme == 'https'


def set_session_cookie(response: Response, request: Request, session_token: str) -> None:
    secure_cookie = is_https_request(request)
    response.set_cookie(
        key='session_token',
        value=session_token,
        httponly=True,
        secure=secure_cookie,
        samesite='none' if secure_cookie else 'lax',
        max_age=SESSION_EXPIRATION_SECONDS,
        path='/'
    )


async def create_user_session(user_id: str, session_token: Optional[str] = None) -> str:
    token = session_token or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=SESSION_EXPIRATION_SECONDS)

    # Keep one active session token entry and refresh expiry when reused.
    await db.user_sessions.update_one(
        {'session_token': token},
        {
            '$set': {
                'user_id': user_id,
                'expires_at': expires_at,
                'created_at': now,
            }
        },
        upsert=True
    )
    return token

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    # First check for session_token cookie (Emergent Auth)
    session_token = request.cookies.get('session_token')
    
    if session_token:
        session = await db.user_sessions.find_one({'session_token': session_token})
        if session:
            expires_at = parse_stored_datetime(session.get('expires_at'))
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({'id': session['user_id']}, {'_id': 0, 'password_hash': 0})
                if user:
                    return User(**user)
            else:
                # Clean up invalid/expired session rows.
                await db.user_sessions.delete_one({'session_token': session_token})
    
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
async def register(req: RegisterRequest, response: Response, request: Request):
    normalized_email = normalize_email(str(req.email))

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')

    # Check if user exists
    existing = await db.users.find_one({'email': normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user = User(
        email=normalized_email,
        name=req.name.strip(),
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
    session_token = await create_user_session(user.id)
    set_session_cookie(response, request, session_token)

    user_dict.pop('password_hash', None)
    user_dict.pop('_id', None)  # Remove MongoDB ObjectId if present
    return AuthResponse(token=token, user=user_dict)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, response: Response, request: Request):
    normalized_email = normalize_email(str(req.email))
    user = await db.users.find_one({'email': normalized_email})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_jwt_token(user['id'])
    session_token = await create_user_session(user['id'])
    set_session_cookie(response, request, session_token)

    user.pop('_id', None)
    user.pop('password_hash', None)
    return AuthResponse(token=token, user=user)

@api_router.get("/auth/session-data")
async def get_session_data(request: Request, response: Response, x_session_id: str = Header(...), x_user_type: Optional[str] = Header(None)):
    """Google OAuth session data – supports both creative and business user types.
    If the user already exists we log them in; if they are new we create an account
    using the type provided via the X-User-Type header (defaults to 'creative')."""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': x_session_id}
        ) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=401, detail='Invalid session')
            data = await resp.json()
    
    chosen_type = x_user_type if x_user_type in ('creative', 'business') else 'creative'
    
    # Check if user exists, create if not
    oauth_email = normalize_email(data['email'])
    user = await db.users.find_one({'email': oauth_email})
    is_new_user = False
    if not user:
        is_new_user = True
        new_user = User(
            email=oauth_email,
            name=data['name'],
            user_type=chosen_type,
            picture=data.get('picture')
        )
        user_dict = new_user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        
        # Create profile based on chosen type
        if chosen_type == 'creative':
            profile = WriterProfile(user_id=new_user.id)
            profile_dict = profile.model_dump()
            profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
            await db.writer_profiles.insert_one(profile_dict)
        else:
            profile = BusinessProfile(user_id=new_user.id, company_name=data['name'], industry='')
            profile_dict = profile.model_dump()
            profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
            await db.business_profiles.insert_one(profile_dict)
        
        user = user_dict
    
    # Create/refresh session using upstream token so the cookie and DB stay aligned.
    session_token = await create_user_session(user['id'], session_token=data['session_token'])
    
    # Also generate a JWT token for the frontend
    jwt_token = create_jwt_token(user['id'])
    
    # Set cookie
    set_session_cookie(response, request, session_token)
    
    user.pop('_id', None)
    user.pop('password_hash', None)
    # Include token and is_new flag so frontend can store it and redirect properly
    user['token'] = jwt_token
    user['is_new_user'] = is_new_user
    return user

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(response: Response, request: Request, user: User = Depends(get_current_user)):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_one({'session_token': session_token})

    # Clear both dev and secure-prod cookie variants.
    response.delete_cookie('session_token', path='/', samesite='lax')
    response.delete_cookie('session_token', path='/', samesite='none', secure=True)
    return {'message': 'Logged out'}

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

@api_router.put("/auth/profile")
async def update_user_profile(req: ProfileUpdateRequest, user: User = Depends(get_current_user)):
    """Update user profile (name/email)"""
    update_dict = {}
    
    if req.name:
        update_dict['name'] = req.name
    
    if req.email and normalize_email(str(req.email)) != normalize_email(user.email):
        normalized_email = normalize_email(str(req.email))
        # Check if email is already taken
        existing = await db.users.find_one({'email': normalized_email})
        if existing:
            raise HTTPException(status_code=400, detail='Email already in use')
        update_dict['email'] = normalized_email
    
    if not update_dict:
        raise HTTPException(status_code=400, detail='No fields to update')
    
    await db.users.update_one({'id': user.id}, {'$set': update_dict})
    
    updated_user = await db.users.find_one({'id': user.id}, {'_id': 0, 'password_hash': 0})
    return updated_user

@api_router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, user: User = Depends(get_current_user)):
    """Change user password"""
    # Get user with password hash
    user_doc = await db.users.find_one({'id': user.id})
    
    if not user_doc or not user_doc.get('password_hash'):
        raise HTTPException(status_code=400, detail='Cannot change password for OAuth users')
    
    # Verify current password
    if not verify_password(req.current_password, user_doc['password_hash']):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    
    # Validate new password
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail='New password must be at least 6 characters')
    
    # Update password
    new_hash = hash_password(req.new_password)
    await db.users.update_one({'id': user.id}, {'$set': {'password_hash': new_hash}})
    
    return {'message': 'Password changed successfully'}

@api_router.put("/auth/settings")
async def update_settings(req: SettingsUpdateRequest, user: User = Depends(get_current_user)):
    """Save user settings to database"""
    settings_dict = {k: v for k, v in req.model_dump().items() if v is not None}
    
    await db.user_settings.update_one(
        {'user_id': user.id},
        {'$set': {**settings_dict, 'updated_at': datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    saved = await db.user_settings.find_one({'user_id': user.id}, {'_id': 0})
    return saved

@api_router.get("/auth/settings")
async def get_settings(user: User = Depends(get_current_user)):
    """Get user settings from database"""
    settings = await db.user_settings.find_one({'user_id': user.id}, {'_id': 0})
    if not settings:
        # Return defaults
        return {
            "user_id": user.id,
            "emailNotifications": True,
            "pushNotifications": False,
            "marketingEmails": False,
            "profileVisibility": True,
            "showEmail": False,
            "darkMode": False,
            "language": "en",
            "autoRespond": False,
            "jobAlerts": True
        }
    return settings

@api_router.delete("/auth/account")
async def delete_account(user: User = Depends(get_current_user)):
    """Permanently delete user account and all related data"""
    user_id = user.id
    
    # Delete user and all related data
    await db.users.delete_one({'id': user_id})
    await db.writer_profiles.delete_many({'user_id': user_id})
    await db.business_profiles.delete_many({'user_id': user_id})
    await db.writing_samples.delete_many({'user_id': user_id})
    await db.applications.delete_many({'writer_user_id': user_id})
    await db.user_sessions.delete_many({'user_id': user_id})
    await db.user_settings.delete_many({'user_id': user_id})
    await db.purchases.delete_many({'business_user_id': user_id})
    await db.purchases.delete_many({'writer_user_id': user_id})
    # Delete business projects
    await db.projects.delete_many({'business_user_id': user_id})
    
    return {'message': 'Account deleted successfully'}

# ============ WRITER ROUTES ============

@api_router.get("/writers/profile")
async def get_writer_profile(user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can view writer profile')

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

@api_router.post("/writers/samples", status_code=201)
async def create_sample(sample: WritingSampleCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can upload samples')
    
    # Check sample count
    count = await db.writing_samples.count_documents({'user_id': user.id})
    if count >= 2:
        raise HTTPException(status_code=400, detail='Maximum 2 samples allowed')

    if not sample.content or not sample.content.strip():
        raise HTTPException(status_code=400, detail='Sample content is required for text uploads')

    price_credits = validate_sample_price(sample.price_credits)
    
    new_sample = WritingSample(
        user_id=user.id,
        title=sample.title,
        content=sample.content,
        genre=sample.genre,
        format=sample.format,
        price_credits=price_credits
    )
    
    sample_dict = new_sample.model_dump()
    sample_dict['created_at'] = sample_dict['created_at'].isoformat()
    await db.writing_samples.insert_one(sample_dict)
    
    return new_sample

@api_router.get("/writers/samples")
async def get_samples(user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can view writer samples')

    samples = await db.writing_samples.find({'user_id': user.id}, {'_id': 0}).to_list(100)
    return samples

@api_router.delete("/writers/samples/{sample_id}")
async def delete_sample(sample_id: str, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can delete writer samples')

    sample = await db.writing_samples.find_one({'id': sample_id, 'user_id': user.id})
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')
    # Delete associated file if it exists
    if sample.get('pdf_url'):
        file_path = ROOT_DIR / 'uploads' / sample['pdf_url'].split('/uploads/')[-1] if '/uploads/' in sample.get('pdf_url', '') else None
        if file_path and file_path.exists():
            file_path.unlink(missing_ok=True)
    await db.writing_samples.delete_one({'id': sample_id, 'user_id': user.id})
    return {'message': 'Sample deleted'}

# Upload file endpoint for writing samples
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@api_router.post("/writers/samples/upload", status_code=201)
async def upload_sample_with_file(
    title: str = Form(...),
    genre: str = Form(...),
    format: str = Form('short_story'),
    price_credits: Optional[int] = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can upload samples')
    
    # Check sample count
    count = await db.writing_samples.count_documents({'user_id': user.id})
    if count >= 2:
        raise HTTPException(status_code=400, detail='Maximum 2 samples allowed')

    price_credits = validate_sample_price(price_credits)
    
    # Validate file extension
    ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f'Only {", ".join(ALLOWED_EXTENSIONS)} files are allowed')
    
    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail='File must be under 10MB')
    
    # Save file to disk
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / safe_filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Extract text content for preview (only for .txt files)
    text_content = ''
    if ext == '.txt':
        try:
            text_content = content.decode('utf-8', errors='replace')[:5000]
        except:
            text_content = '(Text content could not be extracted)'
    else:
        text_content = f'[File: {file.filename}]'
    
    # Create sample record
    new_sample = WritingSample(
        user_id=user.id,
        title=title,
        content=text_content,
        genre=genre,
        format=format,
        pdf_url=f'/api/uploads/{safe_filename}',
        pdf_filename=file.filename,
        pdf_size=len(content),
        price_credits=price_credits
    )
    
    sample_dict = new_sample.model_dump()
    sample_dict['created_at'] = sample_dict['created_at'].isoformat()
    await db.writing_samples.insert_one(sample_dict)
    
    return new_sample

@api_router.get("/writers/discover")
async def discover_writers(user: User = Depends(get_current_user), genre: Optional[str] = None, skip: int = 0, limit: int = 20):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can discover writers')

    purchased_rows = await db.purchases.find(
        {'business_user_id': user.id},
        {'_id': 0, 'sample_id': 1}
    ).to_list(1000)
    purchased_sample_ids = {row['sample_id'] for row in purchased_rows}
    
    # Get all creative users
    query = {'user_type': 'creative'}
    users = await db.users.find(query, {'_id': 0, 'password_hash': 0}).skip(skip).limit(limit).to_list(100)
    
    # Enrich with profiles and samples
    results = []
    for u in users:
        settings = await db.user_settings.find_one({'user_id': u['id']}, {'_id': 0, 'profileVisibility': 1, 'showEmail': 1})
        if settings and settings.get('profileVisibility') is False:
            continue

        profile = await db.writer_profiles.find_one({'user_id': u['id']}, {'_id': 0})
        samples = await db.writing_samples.find({'user_id': u['id']}, {'_id': 0}).to_list(2)
        
        # Filter by genre if specified
        if genre and profile:
            if genre not in profile.get('genres', []):
                continue

        public_user = dict(u)
        if not (settings and settings.get('showEmail') is True):
            public_user.pop('email', None)

        public_samples = []
        for sample in samples:
            sample_copy = {
                'id': sample.get('id'),
                'title': sample.get('title'),
                'genre': sample.get('genre'),
                'format': sample.get('format'),
                'price_credits': sample.get('price_credits'),
                'created_at': sample.get('created_at')
            }
            if sample.get('id') in purchased_sample_ids:
                sample_copy['content'] = sample.get('content')
                sample_copy['pdf_url'] = sample.get('pdf_url')
                sample_copy['pdf_filename'] = sample.get('pdf_filename')
                sample_copy['pdf_size'] = sample.get('pdf_size')
            else:
                preview = (sample.get('content') or '')[:160]
                if preview and len(sample.get('content') or '') > 160:
                    preview += '...'
                sample_copy['content'] = preview

            public_samples.append(sample_copy)
        
        results.append({
            'user': public_user,
            'profile': profile,
            'samples': public_samples
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

@api_router.post("/business/purchase-sample")
async def purchase_sample(req: PurchaseSampleRequest, user: User = Depends(get_current_user)):
    """Business user purchases access to a writing sample using credits"""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can purchase samples')
    
    # Find the sample
    sample = await db.writing_samples.find_one({'id': req.sample_id})
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')
    
    cost = resolve_sample_cost(sample.get('price_credits'))
    
    # Check if already purchased
    existing = await db.purchases.find_one({
        'business_user_id': user.id,
        'sample_id': req.sample_id
    })
    if existing:
        raise HTTPException(status_code=400, detail='You have already purchased this sample')
    
    # Check credits
    profile = await db.business_profiles.find_one({'user_id': user.id})
    if not profile or profile.get('credits', 0) < cost:
        raise HTTPException(status_code=400, detail=f'Not enough credits. Need {cost}, have {profile.get("credits", 0) if profile else 0}')
    
    # Deduct credits
    new_balance = profile['credits'] - cost
    await db.business_profiles.update_one(
        {'user_id': user.id},
        {'$set': {'credits': new_balance}}
    )
    
    # Create purchase record
    purchase = Purchase(
        business_user_id=user.id,
        writer_user_id=sample['user_id'],
        sample_id=req.sample_id,
        credits_spent=cost
    )
    purchase_dict = purchase.model_dump()
    purchase_dict['created_at'] = purchase_dict['created_at'].isoformat()
    await db.purchases.insert_one(purchase_dict)
    
    return {
        'message': 'Sample purchased successfully',
        'credits_remaining': new_balance,
        'purchase_id': purchase.id,
        'sample': {
            'id': sample['id'],
            'title': sample.get('title'),
            'content': sample.get('content'),
            'pdf_url': sample.get('pdf_url'),
            'pdf_filename': sample.get('pdf_filename')
        }
    }

@api_router.get("/business/purchases")
async def get_purchases(user: User = Depends(get_current_user)):
    """Get all samples purchased by the business user"""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can view purchases')
    
    purchases = await db.purchases.find({'business_user_id': user.id}, {'_id': 0}).to_list(100)
    
    # Enrich with sample and writer details
    enriched = []
    for p in purchases:
        sample = await db.writing_samples.find_one({'id': p['sample_id']}, {'_id': 0})
        writer = await db.users.find_one({'id': p['writer_user_id']}, {'_id': 0, 'password_hash': 0})
        p['sample'] = sample
        p['writer'] = writer
        enriched.append(p)
    
    return enriched

@api_router.get("/business/has-purchased/{sample_id}")
async def has_purchased_sample(sample_id: str, user: User = Depends(get_current_user)):
    """Check if business has already purchased a specific sample"""
    if user.user_type != 'business':
        return {'purchased': False}
    existing = await db.purchases.find_one({
        'business_user_id': user.id,
        'sample_id': sample_id
    })
    return {'purchased': bool(existing)}

@api_router.post("/business/projects", status_code=201)
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
    
    # Enrich with application counts
    for project in projects:
        count = await db.applications.count_documents({'project_id': project['id']})
        project['application_count'] = count
    
    return projects

@api_router.delete("/business/projects/{project_id}")
async def delete_project(project_id: str, user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can delete projects')
    
    project = await db.projects.find_one({'id': project_id})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    if project['business_user_id'] != user.id:
        raise HTTPException(status_code=403, detail='Not authorized to delete this project')
    
    await db.projects.delete_one({'id': project_id})
    await db.applications.delete_many({'project_id': project_id})
    return {'message': 'Project deleted successfully'}

@api_router.put("/business/projects/{project_id}")
async def update_project_status(project_id: str, data: ProjectUpdateRequest, user: User = Depends(get_current_user)):
    """Update project status (open, in_progress, completed) and editable fields."""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can update projects')
    
    project = await db.projects.find_one({'id': project_id})
    if not project or project['business_user_id'] != user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    
    update_fields = {}
    if data.status is not None:
        update_fields['status'] = data.status
    if data.title is not None:
        update_fields['title'] = data.title
    if data.description is not None:
        update_fields['description'] = data.description

    if not update_fields:
        raise HTTPException(status_code=400, detail='No valid fields provided')
    
    await db.projects.update_one({'id': project_id}, {'$set': update_fields})
    
    updated = await db.projects.find_one({'id': project_id}, {'_id': 0})
    return updated

@api_router.get("/projects")
async def get_all_projects(user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    projects = await db.projects.find({'status': 'open'}, {'_id': 0}).skip(skip).limit(limit).to_list(100)
    
    # Enrich with business names
    for project in projects:
        business = await db.users.find_one({'id': project.get('business_user_id')}, {'_id': 0, 'password_hash': 0})
        if business:
            project['business_name'] = business.get('name', 'Unknown')
        app_count = await db.applications.count_documents({'project_id': project['id']})
        project['application_count'] = app_count
    
    return projects

# ============ APPLICATION ROUTES ============

@api_router.post("/applications", status_code=201)
async def apply_to_project(application: ApplicationCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only writers can apply to projects')
    
    # Check if project exists
    project = await db.projects.find_one({'id': application.project_id})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    
    # Check if already applied
    existing = await db.applications.find_one({
        'project_id': application.project_id,
        'writer_user_id': user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail='You have already applied to this project')
    
    new_application = Application(
        project_id=application.project_id,
        writer_user_id=user.id,
        cover_letter=application.cover_letter
    )
    
    app_dict = new_application.model_dump()
    app_dict['created_at'] = app_dict['created_at'].isoformat()
    
    await db.applications.insert_one(app_dict)
    return {'message': 'Application submitted successfully', 'application': new_application}

@api_router.get("/applications/my")
async def get_my_applications(user: User = Depends(get_current_user)):
    """Get all applications for the current writer"""
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only writers can view their applications')
    
    applications = await db.applications.find({'writer_user_id': user.id}, {'_id': 0}).to_list(100)
    
    # Enrich with project details
    enriched = []
    for app in applications:
        project = await db.projects.find_one({'id': app['project_id']}, {'_id': 0})
        if project:
            # Get business info
            business = await db.users.find_one({'id': project['business_user_id']}, {'_id': 0, 'password_hash': 0})
            app['project'] = project
            app['business'] = business
        enriched.append(app)
    
    return enriched

@api_router.get("/business/applications")
async def get_project_applications(user: User = Depends(get_current_user)):
    """Get all applications for business's projects"""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can view project applications')
    
    # Get all projects for this business
    projects = await db.projects.find({'business_user_id': user.id}, {'_id': 0}).to_list(100)
    project_ids = [p['id'] for p in projects]
    
    # Get applications for these projects
    applications = await db.applications.find({'project_id': {'$in': project_ids}}, {'_id': 0}).to_list(100)
    
    # Enrich with writer details
    enriched = []
    for app in applications:
        writer = await db.users.find_one({'id': app['writer_user_id']}, {'_id': 0, 'password_hash': 0})
        writer_profile = await db.writer_profiles.find_one({'user_id': app['writer_user_id']}, {'_id': 0})
        project = next((p for p in projects if p['id'] == app['project_id']), None)
        app['writer'] = writer
        app['writer_profile'] = writer_profile
        app['project'] = project
        enriched.append(app)
    
    return enriched

@api_router.put("/applications/{application_id}")
async def update_application_status(application_id: str, update: ApplicationUpdate, user: User = Depends(get_current_user)):
    """Accept or reject an application (business only)"""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can update application status')
    
    # Find application
    application = await db.applications.find_one({'id': application_id})
    if not application:
        raise HTTPException(status_code=404, detail='Application not found')
    
    # Verify the project belongs to this business
    project = await db.projects.find_one({'id': application['project_id']})
    if not project or project['business_user_id'] != user.id:
        raise HTTPException(status_code=403, detail='Not authorized to update this application')
    
    await db.applications.update_one(
        {'id': application_id},
        {'$set': {'status': update.status}}
    )
    
    # If accepted, update project status
    if update.status == 'accepted':
        await db.projects.update_one(
            {'id': application['project_id']},
            {'$set': {'status': 'in_progress'}}
        )
    
    return {'message': f'Application {update.status}'}

@api_router.delete("/applications/{application_id}")
async def withdraw_application(application_id: str, user: User = Depends(get_current_user)):
    """Withdraw an application (writer only)"""
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only writers can withdraw applications')

    application = await db.applications.find_one({'id': application_id})
    if not application:
        raise HTTPException(status_code=404, detail='Application not found')
    
    if application['writer_user_id'] != user.id:
        raise HTTPException(status_code=403, detail='Not authorized')
    
    if application['status'] != 'pending':
        raise HTTPException(status_code=400, detail='Can only withdraw pending applications')
    
    await db.applications.delete_one({'id': application_id})
    return {'message': 'Application withdrawn successfully'}

# ============ AI ROUTES ============

# @api_router.post("/ai/assist")
# async def ai_assist(req: AIRequest, user: User = Depends(get_current_user)):
#     if user.user_type != 'creative':
#         raise HTTPException(status_code=403, detail='AI tools are for creative users')
#     
#     # This endpoint is temporarily disabled due to missing emergentintegrations package
#     raise HTTPException(status_code=501, detail='AI assistance feature is temporarily unavailable')
#     
#     # Original code commented out:
#     # Initialize LLM
#     # chat = LlmChat(
#     #     api_key=os.environ['EMERGENT_LLM_KEY'],
#     #     session_id=f"ai_assist_{user.id}_{datetime.now().timestamp()}",
#     #     system_message="You are a professional writing assistant helping authors improve their work."
#     # ).with_model("openai", "gpt-4o")
#     
#     # Create prompt based on task
#     # prompts = {
#     #     'grammar': f"Check and correct the grammar in the following text. Return only the corrected version:\n\n{req.text}",
#     #     'rewrite': f"Rewrite the following text to make it more engaging and polished:\n\n{req.text}",
#     #     'tone_adjust': f"Adjust the tone of the following text to be {req.tone or 'professional'}:\n\n{req.text}",
#     #     'logline': f"Create a compelling logline or synopsis for the following story:\n\n{req.text}"
#     # }
#     
#     # prompt = prompts.get(req.task, req.text)
#     # message = UserMessage(text=prompt)
#     
#     # response = await chat.send_message(message)
#     # return {'result': response}

# ============ STARTUP & MIDDLEWARE ============

app.include_router(api_router)

# Serve uploaded files
uploads_dir = ROOT_DIR / 'uploads'
uploads_dir.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

cors_origins_env = os.environ.get('CORS_ORIGINS', '*')
if cors_origins_env.strip() == '*':
    # When wildcard, must use allow_origin_regex and credentials=True
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=r".*",
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=[o.strip() for o in cors_origins_env.split(',')],
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