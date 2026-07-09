import asyncio
import io
import logging
import os
import re
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional
from urllib.parse import urlparse

import bcrypt
import jwt
import aiofiles
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('word_up')

# ============ CONFIG ============

ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development').lower()
IS_PRODUCTION = ENVIRONMENT in ('production', 'prod')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'word_up_db')

# Number of trusted reverse-proxy hops in front of the app. The client IP used
# for rate limiting is taken this many entries from the RIGHT of X-Forwarded-For
# (the values a trusted proxy appended), so a client cannot spoof its identity by
# injecting a leftmost XFF value. 0 means do not trust XFF at all.
try:
    TRUSTED_PROXY_COUNT = max(0, int(os.environ.get('TRUSTED_PROXY_COUNT', '1')))
except ValueError:
    TRUSTED_PROXY_COUNT = 1

# A well-known value that shipped with the template. Refuse to boot a production
# server that is still using it so a leaked secret cannot be exploited silently.
_LEAKED_DEFAULT_SECRET = 'word_up_secret_key_2025_secure_random_string'
JWT_SECRET = os.environ.get('JWT_SECRET', '')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', 7))
SESSION_EXPIRATION_SECONDS = JWT_EXPIRATION_DAYS * 24 * 60 * 60

if IS_PRODUCTION and (not JWT_SECRET or JWT_SECRET == _LEAKED_DEFAULT_SECRET):
    raise RuntimeError(
        'JWT_SECRET must be set to a strong, unique value in production. '
        'The bundled default is publicly known and cannot be used.'
    )
if not JWT_SECRET:
    JWT_SECRET = _LEAKED_DEFAULT_SECRET
    logger.warning(
        'JWT_SECRET is not set; using an insecure development default. '
        'Set JWT_SECRET before deploying.'
    )

# Optional external OAuth session bridge (e.g. an Emergent-style provider).
# Left unset by default so the app does not depend on an unowned service.
OAUTH_SESSION_URL = os.environ.get('OAUTH_SESSION_URL', '').strip()

# Password policy shared by every entry point that sets a password.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt truncates beyond this; reject to avoid silent loss.

# Business/discovery pagination bounds.
MAX_PAGE_SIZE = 100

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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
    token_version: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def public(self) -> dict:
        """User fields safe to return to clients."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'user_type': self.user_type,
            'picture': self.picture,
            'created_at': self.created_at.isoformat()
            if isinstance(self.created_at, datetime)
            else self.created_at,
        }


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
    pdf_url: Optional[str] = None
    pdf_filename: Optional[str] = None
    pdf_size: Optional[int] = None
    price_credits: Optional[int] = None  # None = free preview
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BusinessProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    company_name: str
    industry: str
    description: Optional[str] = None
    website: Optional[str] = None
    credits: int = Field(default=10)
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


def _validate_urls(links: List[str]) -> List[str]:
    cleaned = []
    for link in links:
        if not isinstance(link, str):
            continue
        link = link.strip()
        if not link:
            continue
        if len(link) > 500:
            raise ValueError('Links must be under 500 characters')
        parsed = urlparse(link)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('Links must be valid http(s) URLs')
        cleaned.append(link)
    return cleaned


def _validate_optional_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > 500:
        raise ValueError('URL must be under 500 characters')
    parsed = urlparse(value)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise ValueError('Website must be a valid http(s) URL')
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = Field(min_length=1, max_length=120)
    user_type: Literal['creative', 'business']
    location: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class WritingSampleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=50000)
    genre: str = Field(min_length=1, max_length=100)
    format: str = Field(min_length=1, max_length=50)
    price_credits: Optional[int] = None


class WriterProfileUpdate(BaseModel):
    bio: Optional[str] = Field(default=None, max_length=2000)
    genres: Optional[List[str]] = None
    experience_level: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=200)
    languages: Optional[List[str]] = None
    portfolio_links: Optional[List[str]] = None

    @field_validator('portfolio_links')
    @classmethod
    def _check_links(cls, v):
        if v is None:
            return v
        return _validate_urls(v)


class BusinessProfileUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, max_length=200)
    industry: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    website: Optional[str] = None

    @field_validator('website')
    @classmethod
    def _check_website(cls, v):
        return _validate_optional_url(v)


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    genre: str = Field(min_length=1, max_length=100)
    budget_range: Optional[str] = Field(default=None, max_length=100)
    deadline: Optional[datetime] = None


class ApplicationCreate(BaseModel):
    project_id: str
    cover_letter: Optional[str] = Field(default=None, max_length=5000)


class ApplicationUpdate(BaseModel):
    status: Literal['accepted', 'rejected']


class ProjectUpdateRequest(BaseModel):
    status: Optional[Literal['open', 'in_progress', 'completed']] = None
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)


class PurchaseSampleRequest(BaseModel):
    sample_id: str


class GoogleAuthRequest(BaseModel):
    session_id: str
    user_type: Literal['creative', 'business'] = 'creative'


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    # An avatar as a data: URL (image) or an https URL, or "" to clear it.
    picture: Optional[str] = None

    @field_validator('picture')
    @classmethod
    def _check_picture(cls, v):
        if v is None or v == '':
            return v
        if len(v) > 3_000_000:  # ~2MB base64; avatars should be resized client-side
            raise ValueError('Image is too large')
        if not (v.startswith('data:image/') or v.startswith('https://') or v.startswith('http://')):
            raise ValueError('Picture must be an image data URL or an http(s) URL')
        return v


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


def verify_password(password: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f'Password must be at least {MIN_PASSWORD_LENGTH} characters',
        )
    if len(password.encode('utf-8')) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f'Password must be at most {MAX_PASSWORD_BYTES} bytes',
        )


def create_jwt_token(user_id: str, token_version: int = 0) -> str:
    payload = {
        'user_id': user_id,
        'tv': token_version,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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


def extract_document_text(content: bytes, ext: str) -> str:
    """Best-effort text extraction from an uploaded document."""
    try:
        if ext == '.pdf':
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or '') for page in reader.pages)
        if ext == '.docx':
            import docx
            document = docx.Document(io.BytesIO(content))
            return "\n".join(p.text for p in document.paragraphs)
        if ext == '.txt':
            return content.decode('utf-8', errors='replace')
    except Exception as exc:  # noqa: BLE001
        logger.warning('Text extraction failed for %s: %s', ext, exc)
        return ''
    return ''  # e.g. legacy .doc — extraction not supported


def assess_text_quality(text: str, ext: str) -> None:
    """Reject documents that have no real written content (empty, scanned
    images, or random characters). Deliberately lenient so legitimate short
    samples pass; this is a heuristic, not a language model."""
    stripped = (text or '').strip()
    scanned_hint = (
        ' It may be a scanned image or password-protected PDF. Please upload a '
        'PDF with selectable text.'
        if ext == '.pdf' else ''
    )
    if len(stripped) < 100:
        raise HTTPException(
            status_code=400,
            detail='The document has too little readable text. Upload a document with '
            'real written content (a paragraph or more).' + scanned_hint,
        )
    words = re.findall(r"[A-Za-z]{2,}", stripped)
    if len(words) < 20:
        raise HTTPException(
            status_code=400,
            detail='Not enough readable words were found in the document.' + scanned_hint,
        )
    vowel_words = [w for w in words if re.search(r"[aeiouAEIOU]", w)]
    if len(vowel_words) / len(words) < 0.5:
        raise HTTPException(
            status_code=400,
            detail='The document text does not look like readable writing '
            '(it may be random characters or images).',
        )
    if len({w.lower() for w in words}) < 10:
        raise HTTPException(
            status_code=400,
            detail='The document does not contain enough distinct words.',
        )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def clamp_pagination(skip: int, limit: int) -> tuple:
    skip = max(0, skip)
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    return skip, limit


async def fetch_map(collection, field: str, values, projection=None) -> dict:
    """Fetch documents whose `field` is in `values` in one query, keyed by that
    field. Used to batch what would otherwise be N+1 per-row lookups."""
    unique = list({v for v in values if v})
    if not unique:
        return {}
    proj = projection if projection is not None else {'_id': 0}
    docs = await collection.find({field: {'$in': unique}}, proj).to_list(len(unique))
    return {doc.get(field): doc for doc in docs}


_PUBLIC_USER_PROJECTION = {'_id': 0, 'password_hash': 0, 'token_version': 0}


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
    # Trust X-Forwarded-Proto only behind a proxy (the common deploy shape). In
    # production cookies are forced Secure regardless via COOKIE_SECURE below.
    forwarded_proto = request.headers.get('x-forwarded-proto', '').split(',')[0].strip().lower()
    if forwarded_proto:
        return forwarded_proto == 'https'
    return request.url.scheme == 'https'


def set_session_cookie(response: Response, request: Request, session_token: str) -> None:
    secure_cookie = IS_PRODUCTION or is_https_request(request)
    response.set_cookie(
        key='session_token',
        value=session_token,
        httponly=True,
        secure=secure_cookie,
        samesite='none' if secure_cookie else 'lax',
        max_age=SESSION_EXPIRATION_SECONDS,
        path='/',
    )


# ---- Simple in-memory rate limiting (per-process). For multi-instance
# deployments, replace with a shared store such as Redis. ----
_rate_buckets: dict = defaultdict(deque)
# Hard cap on distinct keys so a flood of spoofed/rotating identities cannot grow
# the map without bound (memory-exhaustion DoS). When exceeded we drop the oldest.
_RATE_BUCKETS_MAX_KEYS = 50000


def enforce_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    now = time.monotonic()
    bucket = _rate_buckets[key]
    while bucket and bucket[0] <= now - window_seconds:
        bucket.popleft()
    if len(bucket) >= max_requests:
        raise HTTPException(status_code=429, detail='Too many requests. Please try again later.')
    bucket.append(now)
    # Drop drained buckets and bound total size so the map cannot grow forever.
    _prune_rate_buckets(now)


def _prune_rate_buckets(now: float) -> None:
    # Remove buckets whose newest timestamp is older than the widest window we use
    # (1 hour); such buckets can never block a request and only waste memory.
    if len(_rate_buckets) > _RATE_BUCKETS_MAX_KEYS:
        stale = [k for k, b in _rate_buckets.items() if not b or b[-1] <= now - 3600]
        for k in stale:
            _rate_buckets.pop(k, None)
        # If still over the cap (many active keys), evict arbitrary keys to stay bounded.
        while len(_rate_buckets) > _RATE_BUCKETS_MAX_KEYS:
            _rate_buckets.pop(next(iter(_rate_buckets)), None)


def client_ip(request: Request) -> str:
    # Trust only the proxy hops we control. Proxies APPEND to X-Forwarded-For, so
    # the client-controlled value is always leftmost; taking the Nth-from-right
    # entry (where N = trusted hops) yields the real client address and cannot be
    # spoofed by a client injecting its own leftmost XFF value.
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded and TRUSTED_PROXY_COUNT > 0:
        parts = [p.strip() for p in forwarded.split(',') if p.strip()]
        if parts:
            idx = len(parts) - TRUSTED_PROXY_COUNT
            return parts[max(0, idx)]
    return request.client.host if request.client else 'unknown'


async def create_user_session(user_id: str, session_token: Optional[str] = None) -> str:
    token = session_token or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=SESSION_EXPIRATION_SECONDS)
    await db.user_sessions.update_one(
        {'session_token': token},
        {'$set': {'user_id': user_id, 'expires_at': expires_at, 'created_at': now}},
        upsert=True,
    )
    return token


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    # First check for the session_token cookie.
    session_token = request.cookies.get('session_token')
    if session_token:
        session = await db.user_sessions.find_one({'session_token': session_token})
        if session:
            expires_at = parse_stored_datetime(session.get('expires_at'))
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one(
                    {'id': session['user_id']}, {'_id': 0, 'password_hash': 0}
                )
                if user:
                    return User(**user)
            else:
                await db.user_sessions.delete_one({'session_token': session_token})

    # Fall back to the Authorization header (JWT).
    if credentials:
        payload = verify_jwt_token(credentials.credentials)
        if payload:
            user = await db.users.find_one(
                {'id': payload.get('user_id')}, {'_id': 0, 'password_hash': 0}
            )
            # Reject tokens issued before a password change (token_version bump).
            if user and payload.get('tv', 0) == user.get('token_version', 0):
                return User(**user)

    raise HTTPException(status_code=401, detail='Not authenticated')


# ============ APP ============


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify the database is reachable and set up indexes on startup.
    try:
        await client.admin.command('ping')
        logger.info('Connected to MongoDB at %s', DB_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.error('Could not reach MongoDB on startup: %s', exc)

    try:
        await db.users.create_index('id', unique=True)
        await db.users.create_index('email', unique=True)
        await db.user_sessions.create_index('session_token', unique=True)
        await db.user_sessions.create_index('expires_at', expireAfterSeconds=0)
        await db.writing_samples.create_index('id')
        await db.writing_samples.create_index('user_id')
        await db.writing_samples.create_index('pdf_url')
        await db.writer_profiles.create_index('user_id', unique=True)
        await db.business_profiles.create_index('user_id', unique=True)
        await db.projects.create_index('id')
        await db.projects.create_index('business_user_id')
        await db.projects.create_index('status')
        await db.applications.create_index('id')
        await db.applications.create_index('writer_user_id')
        await db.applications.create_index('project_id')
        await db.applications.create_index(
            [('project_id', ASCENDING), ('writer_user_id', ASCENDING)], unique=True
        )
        await db.purchases.create_index('writer_user_id')
        await db.purchases.create_index('sample_id')
        await db.purchases.create_index(
            [('business_user_id', ASCENDING), ('sample_id', ASCENDING)], unique=True
        )
        logger.info('Database indexes ensured')
    except Exception as exc:  # noqa: BLE001
        logger.warning('Index creation skipped or failed: %s', exc)

    yield
    client.close()


app = FastAPI(
    title='Word Up API',
    description='API for the Word Up two-sided writing marketplace.',
    version='1.0.0',
    lifespan=lifespan,
    # Hide interactive docs in production to avoid disclosing the full API surface.
    docs_url=None if IS_PRODUCTION else '/docs',
    redoc_url=None if IS_PRODUCTION else '/redoc',
    openapi_url=None if IS_PRODUCTION else '/openapi.json',
)
api_router = APIRouter(prefix="/api")

# Private storage for uploaded sample files (served only via authorized route).
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    if IS_PRODUCTION:
        response.headers.setdefault(
            'Strict-Transport-Security', 'max-age=31536000; includeSubDomains'
        )
    return response


# ============ AUTH ROUTES ============


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest, response: Response, request: Request):
    enforce_rate_limit(f'register:{client_ip(request)}', max_requests=20, window_seconds=3600)
    normalized_email = normalize_email(str(req.email))
    validate_password_strength(req.password)

    existing = await db.users.find_one({'email': normalized_email})
    if existing:
        raise HTTPException(status_code=409, detail='Email already registered')

    user = User(
        email=normalized_email,
        name=req.name.strip(),
        user_type=req.user_type,
        password_hash=hash_password(req.password),
    )

    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    try:
        await db.users.insert_one(user_dict)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail='Email already registered')

    if req.user_type == 'creative':
        profile = WriterProfile(user_id=user.id, location=req.location or '')
        profile_dict = profile.model_dump()
        profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
        await db.writer_profiles.insert_one(profile_dict)
    else:
        profile = BusinessProfile(user_id=user.id, company_name=req.name.strip(), industry='')
        profile_dict = profile.model_dump()
        profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
        await db.business_profiles.insert_one(profile_dict)

    token = create_jwt_token(user.id, user.token_version)
    session_token = await create_user_session(user.id)
    set_session_cookie(response, request, session_token)

    return AuthResponse(token=token, user=user.public())


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, response: Response, request: Request):
    enforce_rate_limit(f'login:{client_ip(request)}', max_requests=10, window_seconds=300)
    normalized_email = normalize_email(str(req.email))
    # Also throttle per account so credential stuffing is bounded even if the
    # attacker rotates source IPs.
    enforce_rate_limit(f'login-acct:{normalized_email}', max_requests=10, window_seconds=300)
    user = await db.users.find_one({'email': normalized_email})
    if not user or not verify_password(req.password, user.get('password_hash')):
        raise HTTPException(status_code=401, detail='Invalid credentials')

    token = create_jwt_token(user['id'], user.get('token_version', 0))
    session_token = await create_user_session(user['id'])
    set_session_cookie(response, request, session_token)

    return AuthResponse(token=token, user=User(**user).public())


@api_router.get("/auth/session-data")
async def get_session_data(
    request: Request,
    response: Response,
    x_session_id: str = Header(...),
    x_user_type: Optional[str] = Header(None),
):
    """Exchange an external OAuth session id for a Word Up account/session.

    Requires OAUTH_SESSION_URL to be configured; otherwise the feature is
    disabled so the app never depends on an unowned third-party service.
    """
    if not OAUTH_SESSION_URL:
        raise HTTPException(status_code=503, detail='OAuth sign-in is not configured')

    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as http_client:
            resp = await http_client.get(
                OAUTH_SESSION_URL, headers={'X-Session-ID': x_session_id}
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail='OAuth provider unavailable')

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail='Invalid session')

    data = resp.json()
    email = data.get('email')
    name = data.get('name')
    session_token = data.get('session_token')
    if not email or not name or not session_token:
        raise HTTPException(status_code=502, detail='Malformed OAuth response')

    chosen_type = x_user_type if x_user_type in ('creative', 'business') else 'creative'
    oauth_email = normalize_email(email)

    user = await db.users.find_one({'email': oauth_email})
    is_new_user = False
    if not user:
        is_new_user = True
        new_user = User(
            email=oauth_email,
            name=name,
            user_type=chosen_type,
            picture=data.get('picture'),
        )
        user_dict = new_user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)

        if chosen_type == 'creative':
            profile = WriterProfile(user_id=new_user.id)
            profile_dict = profile.model_dump()
            profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
            await db.writer_profiles.insert_one(profile_dict)
        else:
            profile = BusinessProfile(user_id=new_user.id, company_name=name, industry='')
            profile_dict = profile.model_dump()
            profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
            await db.business_profiles.insert_one(profile_dict)

        user = user_dict

    session_token = await create_user_session(user['id'], session_token=session_token)
    jwt_token = create_jwt_token(user['id'], user.get('token_version', 0))
    set_session_cookie(response, request, session_token)

    result = User(**user).public()
    result['token'] = jwt_token
    result['is_new_user'] = is_new_user
    return result


@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user.public()


@api_router.post("/auth/logout")
async def logout(response: Response, request: Request, user: User = Depends(get_current_user)):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_one({'session_token': session_token})

    response.delete_cookie('session_token', path='/', samesite='lax')
    response.delete_cookie('session_token', path='/', samesite='none', secure=True)
    return {'message': 'Logged out'}


@api_router.put("/auth/profile")
async def update_user_profile(req: ProfileUpdateRequest, user: User = Depends(get_current_user)):
    """Update the current user's name and/or email."""
    update_dict = {}

    if req.name:
        update_dict['name'] = req.name.strip()

    if req.picture is not None:
        # Empty string clears the avatar.
        update_dict['picture'] = req.picture or None

    if req.email and normalize_email(str(req.email)) != normalize_email(user.email):
        # Changing the login identifier requires re-authentication.
        user_doc = await db.users.find_one({'id': user.id})
        if user_doc and user_doc.get('password_hash'):
            if not req.current_password or not verify_password(
                req.current_password, user_doc.get('password_hash')
            ):
                raise HTTPException(
                    status_code=400, detail='Current password is required to change email'
                )
        normalized_email = normalize_email(str(req.email))
        existing = await db.users.find_one({'email': normalized_email})
        if existing:
            raise HTTPException(status_code=409, detail='Email already in use')
        update_dict['email'] = normalized_email

    if not update_dict:
        raise HTTPException(status_code=400, detail='No fields to update')

    try:
        await db.users.update_one({'id': user.id}, {'$set': update_dict})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail='Email already in use')

    updated = await db.users.find_one({'id': user.id}, {'_id': 0, 'password_hash': 0})
    return User(**updated).public()


@api_router.post("/auth/change-password")
async def change_password(
    req: ChangePasswordRequest,
    response: Response,
    request: Request,
    user: User = Depends(get_current_user),
):
    user_doc = await db.users.find_one({'id': user.id})
    if not user_doc or not user_doc.get('password_hash'):
        raise HTTPException(status_code=400, detail='Cannot change password for OAuth users')

    if not verify_password(req.current_password, user_doc.get('password_hash')):
        raise HTTPException(status_code=400, detail='Current password is incorrect')

    validate_password_strength(req.new_password)

    new_hash = hash_password(req.new_password)
    # Bump token_version so all previously issued JWTs are invalidated.
    updated = await db.users.find_one_and_update(
        {'id': user.id},
        {'$set': {'password_hash': new_hash}, '$inc': {'token_version': 1}},
        return_document=ReturnDocument.AFTER,
    )
    new_version = updated.get('token_version', 0) if updated else user.token_version + 1

    # Invalidate every existing session, then start a fresh one for THIS device
    # and hand back a new JWT so the current user stays logged in.
    await db.user_sessions.delete_many({'user_id': user.id})
    session_token = await create_user_session(user.id)
    set_session_cookie(response, request, session_token)
    new_token = create_jwt_token(user.id, new_version)

    return {'message': 'Password changed successfully', 'token': new_token}


@api_router.put("/auth/settings")
async def update_settings(req: SettingsUpdateRequest, user: User = Depends(get_current_user)):
    settings_dict = {k: v for k, v in req.model_dump().items() if v is not None}
    await db.user_settings.update_one(
        {'user_id': user.id},
        {'$set': {**settings_dict, 'updated_at': datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    saved = await db.user_settings.find_one({'user_id': user.id}, {'_id': 0})
    return saved


@api_router.get("/auth/settings")
async def get_settings(user: User = Depends(get_current_user)):
    settings = await db.user_settings.find_one({'user_id': user.id}, {'_id': 0})
    if not settings:
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
            "jobAlerts": True,
        }
    return settings


@api_router.delete("/auth/account")
async def delete_account(user: User = Depends(get_current_user)):
    """Permanently delete the user account and all related data."""
    user_id = user.id

    # Remove uploaded sample files owned by this user from disk.
    async for sample in db.writing_samples.find({'user_id': user_id}):
        _delete_sample_file(sample)

    # If a business is deleting its account, clean up applications to its projects.
    projects = await db.projects.find({'business_user_id': user_id}, {'_id': 0, 'id': 1}).to_list(1000)
    project_ids = [p['id'] for p in projects]
    if project_ids:
        await db.applications.delete_many({'project_id': {'$in': project_ids}})

    await db.users.delete_one({'id': user_id})
    await db.writer_profiles.delete_many({'user_id': user_id})
    await db.business_profiles.delete_many({'user_id': user_id})
    await db.writing_samples.delete_many({'user_id': user_id})
    await db.applications.delete_many({'writer_user_id': user_id})
    await db.user_sessions.delete_many({'user_id': user_id})
    await db.user_settings.delete_many({'user_id': user_id})
    await db.purchases.delete_many({'business_user_id': user_id})
    await db.purchases.delete_many({'writer_user_id': user_id})
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
    await db.writer_profiles.update_one({'user_id': user.id}, {'$set': update_dict}, upsert=True)
    profile = await db.writer_profiles.find_one({'user_id': user.id}, {'_id': 0})
    return profile


@api_router.post("/writers/samples", status_code=201)
async def create_sample(sample: WritingSampleCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can upload samples')

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
        price_credits=price_credits,
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


@api_router.get("/writers/sales")
async def get_writer_sales(user: User = Depends(get_current_user)):
    """Purchases of this writer's samples, so the writer can see what has been
    bought and by whom. The writer keeps the original sample either way."""
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can view sales')

    sales = await db.purchases.find({'writer_user_id': user.id}, {'_id': 0}).to_list(500)
    sales.sort(key=lambda s: s.get('created_at', ''), reverse=True)

    # Totals come from the database, not the (capped) display slice, so a writer
    # with more than 500 sales still sees accurate lifetime sales and earnings.
    total_sales = await db.purchases.count_documents({'writer_user_id': user.id})
    credit_agg = await db.purchases.aggregate([
        {'$match': {'writer_user_id': user.id}},
        {'$group': {'_id': None, 'total': {'$sum': '$credits_spent'}}},
    ]).to_list(1)
    total_credits = int(credit_agg[0]['total']) if credit_agg else 0

    buyer_ids = [s['business_user_id'] for s in sales]
    samples = await fetch_map(db.writing_samples, 'id', [s['sample_id'] for s in sales])
    biz_profiles = await fetch_map(db.business_profiles, 'user_id', buyer_ids)
    buyer_users = await fetch_map(db.users, 'id', buyer_ids, {'_id': 0, 'id': 1, 'name': 1})

    enriched = []
    for s in sales:
        sample = samples.get(s['sample_id']) or s.get('sample_snapshot')
        buyer_name = (
            (biz_profiles.get(s['business_user_id']) or {}).get('company_name')
            or (buyer_users.get(s['business_user_id']) or {}).get('name')
            or 'A business'
        )
        enriched.append({
            'id': s['id'],
            'sample_id': s['sample_id'],
            'credits_spent': s.get('credits_spent', 0),
            'created_at': s.get('created_at'),
            'buyer_name': buyer_name,
            'sample': {
                'title': (sample or {}).get('title', 'Untitled sample'),
                'genre': (sample or {}).get('genre'),
                'format': (sample or {}).get('format'),
            },
        })
    return {'sales': enriched, 'total_sales': total_sales, 'total_credits': total_credits}


def _delete_sample_file(sample: dict) -> None:
    pdf_url = sample.get('pdf_url') or ''
    if '/uploads/' in pdf_url:
        safe_name = pdf_url.split('/uploads/')[-1]
        file_path = UPLOAD_DIR / safe_name
        # Guard against path traversal; only delete inside UPLOAD_DIR.
        try:
            file_path = file_path.resolve()
            if file_path.parent == UPLOAD_DIR.resolve() and file_path.exists():
                file_path.unlink(missing_ok=True)
        except OSError:
            pass


@api_router.delete("/writers/samples/{sample_id}")
async def delete_sample(sample_id: str, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can delete writer samples')
    sample = await db.writing_samples.find_one({'id': sample_id, 'user_id': user.id})
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')
    # Purchasers were promised permanent access: keep the underlying file on
    # disk when any purchase references this sample (their snapshot copy in the
    # purchase record plus this file keep the content reachable).
    has_purchases = await db.purchases.find_one({'sample_id': sample_id})
    if not has_purchases:
        _delete_sample_file(sample)
    await db.writing_samples.delete_one({'id': sample_id, 'user_id': user.id})
    return {'message': 'Sample deleted'}


@api_router.post("/writers/samples/upload", status_code=201)
async def upload_sample_with_file(
    title: str = Form(...),
    genre: str = Form(...),
    format: str = Form('short_story'),
    price_credits: Optional[int] = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only creative users can upload samples')

    count = await db.writing_samples.count_documents({'user_id': user.id})
    if count >= 2:
        raise HTTPException(status_code=400, detail='Maximum 2 samples allowed')

    price_credits = validate_sample_price(price_credits)

    filename = file.filename or ''
    ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail=f'Only {", ".join(sorted(ALLOWED_EXTENSIONS))} files are allowed'
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail='File must be under 10MB')

    # Require the document to contain real readable text (not empty, scanned
    # images, or random characters). Extracted text also becomes the preview.
    # Extraction is CPU-bound (pypdf/python-docx), so run it off the event loop
    # to keep the worker responsive under concurrent uploads, and cap the text
    # before analysis so a huge document cannot make the quality pass expensive.
    extracted = await asyncio.to_thread(extract_document_text, content, ext)
    extracted = extracted[:200000]
    if ext in ('.pdf', '.docx', '.txt'):
        assess_text_quality(extracted, ext)
        text_content = extracted.strip()[:5000]
    else:
        text_content = f'[File: {filename}]'

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / safe_filename
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    new_sample = WritingSample(
        user_id=user.id,
        title=title,
        content=text_content,
        genre=genre,
        format=format,
        pdf_url=f'/api/uploads/{safe_filename}',
        pdf_filename=filename,
        pdf_size=len(content),
        price_credits=price_credits,
    )
    sample_dict = new_sample.model_dump()
    sample_dict['created_at'] = sample_dict['created_at'].isoformat()
    await db.writing_samples.insert_one(sample_dict)
    return new_sample


@api_router.get("/uploads/{filename}")
async def download_sample_file(filename: str, user: User = Depends(get_current_user)):
    """Serve an uploaded sample file only to its owner or a business that
    has purchased the sample. Enforces the paywall at the file level."""
    # Reject any path separators to prevent traversal.
    if '/' in filename or '\\' in filename or '..' in filename:
        raise HTTPException(status_code=400, detail='Invalid filename')

    pdf_url = f'/api/uploads/{filename}'
    sample = await db.writing_samples.find_one({'pdf_url': pdf_url})

    authorized = False
    download_name = filename
    if sample:
        authorized = sample['user_id'] == user.id
        download_name = sample.get('pdf_filename') or filename
        if not authorized and user.user_type == 'business':
            authorized = bool(
                await db.purchases.find_one(
                    {'business_user_id': user.id, 'sample_id': sample['id']}
                )
            )
    else:
        # Sample deleted after purchase: honor the purchase snapshot.
        purchase = await db.purchases.find_one(
            {'business_user_id': user.id, 'sample_snapshot.pdf_url': pdf_url}
        )
        if purchase:
            authorized = True
            download_name = purchase.get('sample_snapshot', {}).get('pdf_filename') or filename

    if not authorized:
        if sample:
            raise HTTPException(
                status_code=403, detail='You must purchase this sample to access the file'
            )
        raise HTTPException(status_code=404, detail='File not found')

    file_path = (UPLOAD_DIR / filename).resolve()
    if file_path.parent != UPLOAD_DIR.resolve() or not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')

    return FileResponse(path=str(file_path), filename=download_name)


@api_router.get("/writers/discover")
async def discover_writers(
    user: User = Depends(get_current_user),
    genre: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can discover writers')

    skip, limit = clamp_pagination(skip, limit)

    purchased_rows = await db.purchases.find(
        {'business_user_id': user.id}, {'_id': 0, 'sample_id': 1}
    ).to_list(1000)
    purchased_sample_ids = {row['sample_id'] for row in purchased_rows}

    users = (
        await db.users.find({'user_type': 'creative'}, {'_id': 0, 'password_hash': 0})
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    user_ids = [u['id'] for u in users]

    # Batch the per-writer lookups into one query each (avoids N+1 round-trips).
    settings_map = await fetch_map(
        db.user_settings, 'user_id', user_ids,
        {'_id': 0, 'user_id': 1, 'profileVisibility': 1, 'showEmail': 1},
    )
    profiles_map = await fetch_map(db.writer_profiles, 'user_id', user_ids)
    sample_rows = await db.writing_samples.find(
        {'user_id': {'$in': user_ids}}, {'_id': 0}
    ).to_list(2 * len(user_ids) + 1) if user_ids else []
    samples_by_user = {}
    for row in sample_rows:
        samples_by_user.setdefault(row['user_id'], [])
        if len(samples_by_user[row['user_id']]) < 2:
            samples_by_user[row['user_id']].append(row)

    results = []
    for u in users:
        settings = settings_map.get(u['id'])
        if settings and settings.get('profileVisibility') is False:
            continue

        profile = profiles_map.get(u['id'])
        samples = samples_by_user.get(u['id'], [])

        if genre and profile and genre not in profile.get('genres', []):
            continue

        public_user = dict(u)
        public_user.pop('token_version', None)
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
                'created_at': sample.get('created_at'),
            }
            if sample.get('id') in purchased_sample_ids:
                sample_copy['content'] = sample.get('content')
                sample_copy['pdf_url'] = sample.get('pdf_url')
                sample_copy['pdf_filename'] = sample.get('pdf_filename')
                sample_copy['pdf_size'] = sample.get('pdf_size')
            else:
                full = sample.get('content') or ''
                preview = full[:160]
                if len(full) > 160:
                    preview += '...'
                sample_copy['content'] = preview
            public_samples.append(sample_copy)

        results.append({'user': public_user, 'profile': profile, 'samples': public_samples})

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
    await db.business_profiles.update_one({'user_id': user.id}, {'$set': update_dict}, upsert=True)
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
    """Business user purchases access to a writing sample using credits."""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can purchase samples')

    sample = await db.writing_samples.find_one({'id': req.sample_id})
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')

    cost = resolve_sample_cost(sample.get('price_credits'))

    existing = await db.purchases.find_one(
        {'business_user_id': user.id, 'sample_id': req.sample_id}
    )
    if existing:
        raise HTTPException(status_code=409, detail='You have already purchased this sample')

    # Atomically deduct credits only if the balance is sufficient. This prevents
    # concurrent purchases from driving the balance negative (double-spend).
    updated = await db.business_profiles.find_one_and_update(
        {'user_id': user.id, 'credits': {'$gte': cost}},
        {'$inc': {'credits': -cost}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        profile = await db.business_profiles.find_one({'user_id': user.id})
        have = profile.get('credits', 0) if profile else 0
        raise HTTPException(status_code=400, detail=f'Not enough credits. Need {cost}, have {have}')

    new_balance = updated['credits']

    purchase = Purchase(
        business_user_id=user.id,
        writer_user_id=sample['user_id'],
        sample_id=req.sample_id,
        credits_spent=cost,
    )
    purchase_dict = purchase.model_dump()
    purchase_dict['created_at'] = purchase_dict['created_at'].isoformat()
    # Snapshot the purchased content so access survives if the writer later
    # deletes the sample or their account.
    purchase_dict['sample_snapshot'] = {
        'id': sample['id'],
        'title': sample.get('title'),
        'content': sample.get('content'),
        'genre': sample.get('genre'),
        'format': sample.get('format'),
        'pdf_url': sample.get('pdf_url'),
        'pdf_filename': sample.get('pdf_filename'),
        'pdf_size': sample.get('pdf_size'),
        'price_credits': sample.get('price_credits'),
    }
    try:
        await db.purchases.insert_one(purchase_dict)
    except DuplicateKeyError:
        # Lost a race with a concurrent purchase; refund the credits we deducted.
        await db.business_profiles.update_one(
            {'user_id': user.id}, {'$inc': {'credits': cost}}
        )
        raise HTTPException(status_code=409, detail='You have already purchased this sample')

    return {
        'message': 'Sample purchased successfully',
        'credits_remaining': new_balance,
        'purchase_id': purchase.id,
        'sample': {
            'id': sample['id'],
            'title': sample.get('title'),
            'content': sample.get('content'),
            'pdf_url': sample.get('pdf_url'),
            'pdf_filename': sample.get('pdf_filename'),
        },
    }


@api_router.get("/business/purchases")
async def get_purchases(user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can view purchases')
    purchases = await db.purchases.find({'business_user_id': user.id}, {'_id': 0}).to_list(200)
    samples = await fetch_map(db.writing_samples, 'id', [p['sample_id'] for p in purchases])
    writers = await fetch_map(
        db.users, 'id', [p['writer_user_id'] for p in purchases], _PUBLIC_USER_PROJECTION
    )
    for p in purchases:
        # Fall back to the snapshot taken at purchase time if the writer has
        # since deleted the sample — purchased access is permanent.
        p['sample'] = samples.get(p['sample_id']) or p.get('sample_snapshot')
        p['writer'] = writers.get(p['writer_user_id'])
    return purchases


@api_router.get("/business/has-purchased/{sample_id}")
async def has_purchased_sample(sample_id: str, user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        return {'purchased': False}
    existing = await db.purchases.find_one(
        {'business_user_id': user.id, 'sample_id': sample_id}
    )
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
        deadline=project.deadline,
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
async def update_project_status(
    project_id: str, data: ProjectUpdateRequest, user: User = Depends(get_current_user)
):
    """Update project status and editable fields."""
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can update projects')
    project = await db.projects.find_one({'id': project_id})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    if project['business_user_id'] != user.id:
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
    skip, limit = clamp_pagination(skip, limit)
    projects = (
        await db.projects.find({'status': 'open'}, {'_id': 0})
        .sort('created_at', -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    businesses = await fetch_map(
        db.users, 'id', [p.get('business_user_id') for p in projects], {'_id': 0, 'id': 1, 'name': 1}
    )
    project_ids = [p['id'] for p in projects]
    # Count per project in the database so the tally cannot truncate no matter how
    # many applications exist (one row returned per project, not one per application).
    counts = {}
    if project_ids:
        grouped = await db.applications.aggregate([
            {'$match': {'project_id': {'$in': project_ids}}},
            {'$group': {'_id': '$project_id', 'n': {'$sum': 1}}},
        ]).to_list(len(project_ids))
        counts = {row['_id']: row['n'] for row in grouped}
    for project in projects:
        business = businesses.get(project.get('business_user_id'))
        project['business_name'] = business.get('name', 'Unknown') if business else 'Unknown'
        project['application_count'] = counts.get(project['id'], 0)
    return projects


# ============ APPLICATION ROUTES ============


@api_router.post("/applications", status_code=201)
async def apply_to_project(application: ApplicationCreate, user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only writers can apply to projects')

    project = await db.projects.find_one({'id': application.project_id})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    if project.get('status') != 'open':
        raise HTTPException(status_code=400, detail='This project is no longer accepting applications')

    existing = await db.applications.find_one(
        {'project_id': application.project_id, 'writer_user_id': user.id}
    )
    if existing:
        raise HTTPException(status_code=409, detail='You have already applied to this project')

    new_application = Application(
        project_id=application.project_id,
        writer_user_id=user.id,
        cover_letter=application.cover_letter,
    )
    app_dict = new_application.model_dump()
    app_dict['created_at'] = app_dict['created_at'].isoformat()
    try:
        await db.applications.insert_one(app_dict)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail='You have already applied to this project')
    return {'message': 'Application submitted successfully', 'application': new_application}


@api_router.get("/applications/my")
async def get_my_applications(user: User = Depends(get_current_user)):
    if user.user_type != 'creative':
        raise HTTPException(status_code=403, detail='Only writers can view their applications')
    applications = await db.applications.find({'writer_user_id': user.id}, {'_id': 0}).to_list(200)
    projects = await fetch_map(db.projects, 'id', [a['project_id'] for a in applications])
    businesses = await fetch_map(
        db.users, 'id', [p.get('business_user_id') for p in projects.values()],
        _PUBLIC_USER_PROJECTION,
    )
    for app in applications:
        project = projects.get(app['project_id'])
        if project:
            app['project'] = project
            app['business'] = businesses.get(project['business_user_id'])
    return applications


@api_router.get("/business/applications")
async def get_project_applications(user: User = Depends(get_current_user)):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can view project applications')
    projects = await db.projects.find({'business_user_id': user.id}, {'_id': 0}).to_list(200)
    projects_by_id = {p['id']: p for p in projects}
    applications = await db.applications.find(
        {'project_id': {'$in': list(projects_by_id)}}, {'_id': 0}
    ).to_list(500)
    writer_ids = [a['writer_user_id'] for a in applications]
    writers = await fetch_map(db.users, 'id', writer_ids, _PUBLIC_USER_PROJECTION)
    writer_profiles = await fetch_map(db.writer_profiles, 'user_id', writer_ids)
    for app in applications:
        app['writer'] = writers.get(app['writer_user_id'])
        app['writer_profile'] = writer_profiles.get(app['writer_user_id'])
        app['project'] = projects_by_id.get(app['project_id'])
    return applications


@api_router.put("/applications/{application_id}")
async def update_application_status(
    application_id: str, update: ApplicationUpdate, user: User = Depends(get_current_user)
):
    if user.user_type != 'business':
        raise HTTPException(status_code=403, detail='Only business users can update application status')

    application = await db.applications.find_one({'id': application_id})
    if not application:
        raise HTTPException(status_code=404, detail='Application not found')

    project = await db.projects.find_one({'id': application['project_id']})
    if not project or project['business_user_id'] != user.id:
        raise HTTPException(status_code=403, detail='Not authorized to update this application')

    await db.applications.update_one(
        {'id': application_id}, {'$set': {'status': update.status}}
    )
    if update.status == 'accepted':
        await db.projects.update_one(
            {'id': application['project_id']}, {'$set': {'status': 'in_progress'}}
        )
    return {'message': f'Application {update.status}'}


@api_router.delete("/applications/{application_id}")
async def withdraw_application(application_id: str, user: User = Depends(get_current_user)):
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


# ============ HEALTH ============


@api_router.get("/health")
async def health_check():
    db_ok = True
    try:
        await client.admin.command('ping')
    except Exception:  # noqa: BLE001
        db_ok = False
    return {'status': 'ok' if db_ok else 'degraded', 'database': 'up' if db_ok else 'down'}


# ============ WIRING & MIDDLEWARE ============

app.include_router(api_router)

# CORS. The frontend sends credentialed requests (withCredentials), and a
# browser rejects a wildcard `Access-Control-Allow-Origin` on such requests, so
# we never combine "*" with credentials in production.
#
#   - CORS_ORIGINS = comma-separated list -> allow exactly those origins with
#     credentials (the correct production setting).
#   - CORS_ORIGINS unset or "*":
#       * development -> reflect ANY origin with credentials, so the app works
#         from localhost, 127.0.0.1, or a LAN IP (mobile testing) with no config.
#       * production  -> reflect any origin WITHOUT credentials and warn, since
#         wildcard + credentials would be an account-takeover surface. Set an
#         explicit CORS_ORIGINS list to enable cookie auth in production.
cors_origins_env = os.environ.get('CORS_ORIGINS', '').strip()
_explicit_origins = (
    [o.strip() for o in cors_origins_env.split(',') if o.strip()]
    if cors_origins_env and cors_origins_env != '*'
    else []
)
if _explicit_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_explicit_origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
elif IS_PRODUCTION:
    logger.warning(
        'CORS_ORIGINS is not set to an explicit list; cross-origin cookie auth '
        'is disabled. Set CORS_ORIGINS to your frontend origin(s) in production.'
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=False,
        allow_methods=['*'],
        allow_headers=['*'],
    )
else:
    # Development: reflect any origin so localhost / LAN IP both work.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex='.*',
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
