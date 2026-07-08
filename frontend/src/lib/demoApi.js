/*
 * In-browser demo backend for Word Up.
 *
 * When REACT_APP_DEMO_MODE === 'true', this installs a custom axios adapter that
 * fully emulates the FastAPI backend against localStorage — so the deployed
 * static site (GitHub Pages / artifact) supports the entire flow (sign-up,
 * login, document upload, discover, purchase, download) with NO server.
 *
 * Data lives only in the visitor's browser and can be reset from the banner.
 */

const DB_KEY = 'wordup_demo_db_v1';

// Seed friendly demo accounts on first run (disabled for deterministic tests).
const DEMO_SEED = process.env.REACT_APP_DEMO_SEED !== 'false';

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return {
    users: [],
    writer_profiles: [],
    business_profiles: [],
    writing_samples: [],
    projects: [],
    applications: [],
    purchases: [],
    user_settings: [],
    files: {}, // safeFilename -> { dataUrl, filename, size }
    seeded: false,
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return { ...emptyDb(), ...JSON.parse(raw) };
  } catch (e) {
    /* fall through to fresh db */
  }
  return emptyDb();
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDemoData() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem('auth_token');
}

function hashPw(pw) {
  // Not real security — demo only. Obfuscate so plaintext isn't in storage.
  return 'demo$' + btoa(unescape(encodeURIComponent(pw)));
}
function checkPw(pw, hash) {
  return hash === hashPw(pw);
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    user_type: u.user_type,
    picture: u.picture || null,
    created_at: u.created_at,
  };
}

function makeToken(u) {
  return `demo.${u.id}.${u.token_version || 0}`;
}

class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function currentUser(db, config) {
  const auth = config.headers?.Authorization || config.headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts[0] !== 'demo') return null;
  const user = db.users.find((u) => u.id === parts[1]);
  if (!user) return null;
  if (String(user.token_version || 0) !== parts[2]) return null;
  return user;
}

function requireUser(db, config) {
  const u = currentUser(db, config);
  if (!u) throw new ApiError(401, 'Not authenticated');
  return u;
}

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.txt'];

function seed(db) {
  if (db.seeded) return;
  if (!DEMO_SEED) {
    db.seeded = true;
    return;
  }
  // A demo writer with a sample + a demo business with an open project, so a
  // freshly registered business immediately has someone to discover.
  const writerId = uuid();
  db.users.push({
    id: writerId,
    email: 'demo.writer@wordup.app',
    name: 'Ava Demo (Writer)',
    user_type: 'creative',
    password_hash: hashPw('demo1234'),
    picture: null,
    token_version: 0,
    created_at: nowIso(),
  });
  db.writer_profiles.push({
    user_id: writerId,
    bio: 'Award-nominated short-fiction writer. This is a demo account. Log in with demo.writer@wordup.app and password demo1234.',
    genres: ['Fiction', 'Sci-Fi'],
    experience_level: 'professional',
    location: 'Remote',
    languages: ['English'],
    portfolio_links: [],
    updated_at: nowIso(),
  });
  db.writing_samples.push({
    id: uuid(),
    user_id: writerId,
    title: 'The Lighthouse at the Edge of Time',
    content:
      'The lighthouse had not turned in a hundred years, yet every sailor swore they had seen its beam. '.repeat(
        8
      ),
    genre: 'Sci-Fi',
    format: 'short_story',
    pdf_url: null,
    pdf_filename: null,
    pdf_size: null,
    price_credits: 2,
    created_at: nowIso(),
  });

  const bizId = uuid();
  db.users.push({
    id: bizId,
    email: 'demo.business@wordup.app',
    name: 'Northwind Studios',
    user_type: 'business',
    password_hash: hashPw('demo1234'),
    picture: null,
    token_version: 0,
    created_at: nowIso(),
  });
  db.business_profiles.push({
    user_id: bizId,
    company_name: 'Northwind Studios',
    industry: 'Film & Television',
    description: 'Demo business account. Log in with demo.business@wordup.app and password demo1234.',
    website: '',
    credits: 10,
    updated_at: nowIso(),
  });
  db.projects.push({
    id: uuid(),
    business_user_id: bizId,
    title: 'Short Story for Brand Campaign',
    description:
      'Seeking a 2,000-word original short story that subtly features our product. Fiction writers welcome.',
    genre: 'Fiction',
    budget_range: 'R300 - R500',
    deadline: null,
    status: 'open',
    created_at: nowIso(),
  });

  db.seeded = true;
}

// ---- Route handlers -------------------------------------------------------

function getSettings(db, userId) {
  return (
    db.user_settings.find((s) => s.user_id === userId) || {
      user_id: userId,
      emailNotifications: true,
      pushNotifications: false,
      marketingEmails: false,
      profileVisibility: true,
      showEmail: false,
      darkMode: false,
      language: 'en',
      autoRespond: false,
      jobAlerts: true,
    }
  );
}

async function handle(db, method, path, body, config) {
  const M = method.toUpperCase();

  // ---------- AUTH ----------
  if (path === '/auth/register' && M === 'POST') {
    const email = normEmail(body.email);
    if (!body.password || body.password.length < 8)
      throw new ApiError(400, 'Password must be at least 8 characters');
    if (!email || !/.+@.+\..+/.test(email)) throw new ApiError(422, 'A valid email is required');
    if (db.users.some((u) => u.email === email))
      throw new ApiError(409, 'Email already registered');
    const user = {
      id: uuid(),
      email,
      name: (body.name || '').trim(),
      user_type: body.user_type,
      password_hash: hashPw(body.password),
      picture: null,
      token_version: 0,
      created_at: nowIso(),
    };
    db.users.push(user);
    if (body.user_type === 'creative') {
      db.writer_profiles.push({
        user_id: user.id,
        bio: null,
        genres: [],
        experience_level: null,
        location: body.location || '',
        languages: [],
        portfolio_links: [],
        updated_at: nowIso(),
      });
    } else {
      db.business_profiles.push({
        user_id: user.id,
        company_name: (body.name || '').trim(),
        industry: '',
        description: null,
        website: null,
        credits: 10,
        updated_at: nowIso(),
      });
    }
    return { token: makeToken(user), user: publicUser(user) };
  }

  if (path === '/auth/login' && M === 'POST') {
    const email = normEmail(body.email);
    const user = db.users.find((u) => u.email === email);
    if (!user || !checkPw(body.password, user.password_hash))
      throw new ApiError(401, 'Invalid credentials');
    return { token: makeToken(user), user: publicUser(user) };
  }

  if (path === '/auth/session-data' && M === 'GET') {
    throw new ApiError(503, 'Google sign-in is not available in the demo. Use email sign-up.');
  }

  if (path === '/auth/me' && M === 'GET') {
    return publicUser(requireUser(db, config));
  }

  if (path === '/auth/logout' && M === 'POST') {
    return { message: 'Logged out' };
  }

  if (path === '/auth/profile' && M === 'PUT') {
    const user = requireUser(db, config);
    if (body.name) user.name = body.name.trim();
    if (body.picture !== undefined) user.picture = body.picture;
    if (body.email && normEmail(body.email) !== user.email) {
      if (user.password_hash && !checkPw(body.current_password || '', user.password_hash))
        throw new ApiError(400, 'Current password is required to change email');
      const e = normEmail(body.email);
      if (db.users.some((u) => u.email === e && u.id !== user.id))
        throw new ApiError(409, 'Email already in use');
      user.email = e;
    }
    return publicUser(user);
  }

  if (path === '/auth/change-password' && M === 'POST') {
    const user = requireUser(db, config);
    if (!user.password_hash) throw new ApiError(400, 'Cannot change password for OAuth users');
    if (!checkPw(body.current_password, user.password_hash))
      throw new ApiError(400, 'Current password is incorrect');
    if (!body.new_password || body.new_password.length < 8)
      throw new ApiError(400, 'Password must be at least 8 characters');
    user.password_hash = hashPw(body.new_password);
    user.token_version = (user.token_version || 0) + 1;
    return { message: 'Password changed successfully', token: makeToken(user) };
  }

  if (path === '/auth/settings' && M === 'GET') {
    return getSettings(db, requireUser(db, config).id);
  }
  if (path === '/auth/settings' && M === 'PUT') {
    const user = requireUser(db, config);
    let s = db.user_settings.find((x) => x.user_id === user.id);
    if (!s) {
      s = { ...getSettings(db, user.id) };
      db.user_settings.push(s);
    }
    Object.entries(body).forEach(([k, v]) => {
      if (v !== null && v !== undefined) s[k] = v;
    });
    s.updated_at = nowIso();
    return s;
  }

  if (path === '/auth/account' && M === 'DELETE') {
    const user = requireUser(db, config);
    const uid = user.id;
    const myProjectIds = db.projects.filter((p) => p.business_user_id === uid).map((p) => p.id);
    db.applications = db.applications.filter(
      (a) => a.writer_user_id !== uid && !myProjectIds.includes(a.project_id)
    );
    db.users = db.users.filter((u) => u.id !== uid);
    db.writer_profiles = db.writer_profiles.filter((p) => p.user_id !== uid);
    db.business_profiles = db.business_profiles.filter((p) => p.user_id !== uid);
    db.writing_samples = db.writing_samples.filter((s) => s.user_id !== uid);
    db.user_settings = db.user_settings.filter((s) => s.user_id !== uid);
    db.purchases = db.purchases.filter(
      (p) => p.business_user_id !== uid && p.writer_user_id !== uid
    );
    db.projects = db.projects.filter((p) => p.business_user_id !== uid);
    return { message: 'Account deleted successfully' };
  }

  // ---------- WRITER ----------
  if (path === '/writers/profile' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can view writer profile');
    const p = db.writer_profiles.find((x) => x.user_id === user.id);
    if (!p) throw new ApiError(404, 'Profile not found');
    return p;
  }
  if (path === '/writers/profile' && M === 'PUT') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can update writer profile');
    let p = db.writer_profiles.find((x) => x.user_id === user.id);
    if (!p) {
      p = { user_id: user.id, genres: [], languages: [], portfolio_links: [] };
      db.writer_profiles.push(p);
    }
    Object.entries(body).forEach(([k, v]) => {
      if (v !== null && v !== undefined) p[k] = v;
    });
    p.updated_at = nowIso();
    return p;
  }

  if (path === '/writers/samples' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can view writer samples');
    return db.writing_samples.filter((s) => s.user_id === user.id);
  }
  if (path === '/writers/samples' && M === 'POST') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can upload samples');
    if (db.writing_samples.filter((s) => s.user_id === user.id).length >= 2)
      throw new ApiError(400, 'Maximum 2 samples allowed');
    if (!body.content || !body.content.trim())
      throw new ApiError(400, 'Sample content is required for text uploads');
    if (body.price_credits != null && body.price_credits < 1)
      throw new ApiError(400, 'Sample price must be at least 1 credit');
    const sample = {
      id: uuid(),
      user_id: user.id,
      title: body.title,
      content: body.content,
      genre: body.genre,
      format: body.format,
      pdf_url: null,
      pdf_filename: null,
      pdf_size: null,
      price_credits: body.price_credits ?? null,
      created_at: nowIso(),
    };
    db.writing_samples.push(sample);
    return sample;
  }

  if (path === '/writers/samples/upload' && M === 'POST') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can upload samples');
    if (db.writing_samples.filter((s) => s.user_id === user.id).length >= 2)
      throw new ApiError(400, 'Maximum 2 samples allowed');
    // body is a FormData
    const file = body.get('file');
    const filename = file?.name || '';
    const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
    if (!ALLOWED_EXT.includes(ext))
      throw new ApiError(400, `Only ${ALLOWED_EXT.join(', ')} files are allowed`);
    if (file.size > 10 * 1024 * 1024) throw new ApiError(400, 'File must be under 10MB');
    const priceRaw = body.get('price_credits');
    const price = priceRaw != null && priceRaw !== '' ? parseInt(priceRaw, 10) : null;
    if (price != null && price < 1) throw new ApiError(400, 'Sample price must be at least 1 credit');

    const dataUrl = await fileToDataUrl(file);
    const safe = uuid() + ext;
    db.files[safe] = { dataUrl, filename, size: file.size };
    let text = `[File: ${filename}]`;
    if (ext === '.txt') {
      try {
        text = decodeURIComponent(escape(atob(dataUrl.split(',')[1]))).slice(0, 5000);
      } catch (e) {
        text = '(Text content could not be extracted)';
      }
    }
    const sample = {
      id: uuid(),
      user_id: user.id,
      title: body.get('title'),
      content: text,
      genre: body.get('genre'),
      format: body.get('format') || 'short_story',
      pdf_url: `/api/uploads/${safe}`,
      pdf_filename: filename,
      pdf_size: file.size,
      price_credits: price,
      created_at: nowIso(),
    };
    db.writing_samples.push(sample);
    return sample;
  }

  if (path.startsWith('/writers/samples/') && M === 'DELETE') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only creative users can delete writer samples');
    const id = path.split('/').pop();
    const sample = db.writing_samples.find((s) => s.id === id && s.user_id === user.id);
    if (!sample) throw new ApiError(404, 'Sample not found');
    const hasPurchases = db.purchases.some((p) => p.sample_id === id);
    if (!hasPurchases && sample.pdf_url) {
      const safe = sample.pdf_url.split('/uploads/').pop();
      delete db.files[safe];
    }
    db.writing_samples = db.writing_samples.filter((s) => s.id !== id);
    return { message: 'Sample deleted' };
  }

  if (path === '/writers/discover' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can discover writers');
    const purchasedIds = new Set(
      db.purchases.filter((p) => p.business_user_id === user.id).map((p) => p.sample_id)
    );
    const results = [];
    for (const u of db.users.filter((x) => x.user_type === 'creative')) {
      const settings = db.user_settings.find((s) => s.user_id === u.id);
      if (settings && settings.profileVisibility === false) continue;
      const profile = db.writer_profiles.find((p) => p.user_id === u.id) || null;
      const samples = db.writing_samples.filter((s) => s.user_id === u.id).slice(0, 2);
      const pub = publicUser(u);
      if (!(settings && settings.showEmail === true)) delete pub.email;
      const publicSamples = samples.map((s) => {
        const base = {
          id: s.id,
          title: s.title,
          genre: s.genre,
          format: s.format,
          price_credits: s.price_credits,
          created_at: s.created_at,
        };
        if (purchasedIds.has(s.id)) {
          return {
            ...base,
            content: s.content,
            pdf_url: s.pdf_url,
            pdf_filename: s.pdf_filename,
            pdf_size: s.pdf_size,
          };
        }
        const full = s.content || '';
        return { ...base, content: full.slice(0, 160) + (full.length > 160 ? '...' : '') };
      });
      results.push({ user: pub, profile, samples: publicSamples });
    }
    return results;
  }

  // ---------- FILE DOWNLOAD ----------
  if (path.startsWith('/uploads/') && M === 'GET') {
    const user = requireUser(db, config);
    const safe = path.split('/uploads/').pop();
    const pdfUrl = `/api/uploads/${safe}`;
    const sample = db.writing_samples.find((s) => s.pdf_url === pdfUrl);
    let authorized = false;
    if (sample) {
      authorized =
        sample.user_id === user.id ||
        (user.user_type === 'business' &&
          db.purchases.some((p) => p.business_user_id === user.id && p.sample_id === sample.id));
    } else {
      authorized = db.purchases.some(
        (p) => p.business_user_id === user.id && p.sample_snapshot?.pdf_url === pdfUrl
      );
    }
    if (!authorized) throw new ApiError(sample ? 403 : 404, sample ? 'You must purchase this sample to access the file' : 'File not found');
    const f = db.files[safe];
    if (!f) throw new ApiError(404, 'File not found');
    return { __blob: dataUrlToBlob(f.dataUrl) };
  }

  // ---------- BUSINESS ----------
  if (path === '/business/profile' && M === 'GET') {
    const user = requireUser(db, config);
    const p = db.business_profiles.find((x) => x.user_id === user.id);
    if (!p) throw new ApiError(404, 'Profile not found');
    return p;
  }
  if (path === '/business/profile' && M === 'PUT') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can update business profile');
    let p = db.business_profiles.find((x) => x.user_id === user.id);
    if (!p) {
      p = { user_id: user.id, credits: 10 };
      db.business_profiles.push(p);
    }
    Object.entries(body).forEach(([k, v]) => {
      if (v !== null && v !== undefined) p[k] = v;
    });
    p.updated_at = nowIso();
    return p;
  }
  if (path === '/business/credits' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users have credits');
    const p = db.business_profiles.find((x) => x.user_id === user.id);
    return { credits: p ? p.credits || 0 : 0 };
  }
  if (path === '/business/purchase-sample' && M === 'POST') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can purchase samples');
    const sample = db.writing_samples.find((s) => s.id === body.sample_id);
    if (!sample) throw new ApiError(404, 'Sample not found');
    const cost = sample.price_credits && sample.price_credits > 0 ? sample.price_credits : 1;
    if (db.purchases.some((p) => p.business_user_id === user.id && p.sample_id === sample.id))
      throw new ApiError(409, 'You have already purchased this sample');
    const profile = db.business_profiles.find((x) => x.user_id === user.id);
    if (!profile || (profile.credits || 0) < cost)
      throw new ApiError(400, `Not enough credits. Need ${cost}, have ${profile ? profile.credits || 0 : 0}`);
    profile.credits -= cost;
    const purchase = {
      id: uuid(),
      business_user_id: user.id,
      writer_user_id: sample.user_id,
      sample_id: sample.id,
      credits_spent: cost,
      created_at: nowIso(),
      sample_snapshot: {
        id: sample.id,
        title: sample.title,
        content: sample.content,
        genre: sample.genre,
        format: sample.format,
        pdf_url: sample.pdf_url,
        pdf_filename: sample.pdf_filename,
        pdf_size: sample.pdf_size,
        price_credits: sample.price_credits,
      },
    };
    db.purchases.push(purchase);
    return {
      message: 'Sample purchased successfully',
      credits_remaining: profile.credits,
      purchase_id: purchase.id,
      sample: {
        id: sample.id,
        title: sample.title,
        content: sample.content,
        pdf_url: sample.pdf_url,
        pdf_filename: sample.pdf_filename,
      },
    };
  }
  if (path === '/business/purchases' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can view purchases');
    return db.purchases
      .filter((p) => p.business_user_id === user.id)
      .map((p) => {
        const sample =
          db.writing_samples.find((s) => s.id === p.sample_id) || p.sample_snapshot || null;
        const writer = publicUser(db.users.find((u) => u.id === p.writer_user_id));
        return { ...p, sample, writer };
      });
  }
  if (path.startsWith('/business/has-purchased/') && M === 'GET') {
    const user = currentUser(db, config);
    if (!user || user.user_type !== 'business') return { purchased: false };
    const id = path.split('/').pop();
    return {
      purchased: db.purchases.some((p) => p.business_user_id === user.id && p.sample_id === id),
    };
  }
  if (path === '/business/projects' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can view their projects');
    return db.projects
      .filter((p) => p.business_user_id === user.id)
      .map((p) => ({
        ...p,
        application_count: db.applications.filter((a) => a.project_id === p.id).length,
      }));
  }
  if (path === '/business/projects' && M === 'POST') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can post projects');
    const project = {
      id: uuid(),
      business_user_id: user.id,
      title: body.title,
      description: body.description,
      genre: body.genre,
      budget_range: body.budget_range || null,
      deadline: body.deadline || null,
      status: 'open',
      created_at: nowIso(),
    };
    db.projects.push(project);
    return project;
  }
  if (path.startsWith('/business/projects/') && M === 'DELETE') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can delete projects');
    const id = path.split('/').pop();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new ApiError(404, 'Project not found');
    if (project.business_user_id !== user.id) throw new ApiError(403, 'Not authorized to delete this project');
    db.projects = db.projects.filter((p) => p.id !== id);
    db.applications = db.applications.filter((a) => a.project_id !== id);
    return { message: 'Project deleted successfully' };
  }
  if (path.startsWith('/business/projects/') && M === 'PUT') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can update projects');
    const id = path.split('/').pop();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new ApiError(404, 'Project not found');
    if (project.business_user_id !== user.id) throw new ApiError(403, 'Not authorized');
    if (body.status != null) project.status = body.status;
    if (body.title != null) project.title = body.title;
    if (body.description != null) project.description = body.description;
    return project;
  }
  if (path === '/business/applications' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can view project applications');
    const projects = db.projects.filter((p) => p.business_user_id === user.id);
    const ids = projects.map((p) => p.id);
    return db.applications
      .filter((a) => ids.includes(a.project_id))
      .map((a) => ({
        ...a,
        writer: publicUser(db.users.find((u) => u.id === a.writer_user_id)),
        writer_profile: db.writer_profiles.find((p) => p.user_id === a.writer_user_id) || null,
        project: projects.find((p) => p.id === a.project_id) || null,
      }));
  }

  // ---------- PROJECTS / APPLICATIONS ----------
  if (path === '/projects' && M === 'GET') {
    requireUser(db, config);
    return db.projects
      .filter((p) => p.status === 'open')
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((p) => {
        const business = db.users.find((u) => u.id === p.business_user_id);
        return {
          ...p,
          business_name: business ? business.name : 'Unknown',
          application_count: db.applications.filter((a) => a.project_id === p.id).length,
        };
      });
  }
  if (path === '/applications' && M === 'POST') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only writers can apply to projects');
    const project = db.projects.find((p) => p.id === body.project_id);
    if (!project) throw new ApiError(404, 'Project not found');
    if (project.status !== 'open') throw new ApiError(400, 'This project is no longer accepting applications');
    if (db.applications.some((a) => a.project_id === body.project_id && a.writer_user_id === user.id))
      throw new ApiError(409, 'You have already applied to this project');
    const application = {
      id: uuid(),
      project_id: body.project_id,
      writer_user_id: user.id,
      cover_letter: body.cover_letter || null,
      status: 'pending',
      created_at: nowIso(),
    };
    db.applications.push(application);
    return { message: 'Application submitted successfully', application };
  }
  if (path === '/applications/my' && M === 'GET') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only writers can view their applications');
    return db.applications
      .filter((a) => a.writer_user_id === user.id)
      .map((a) => {
        const project = db.projects.find((p) => p.id === a.project_id) || null;
        const business = project ? publicUser(db.users.find((u) => u.id === project.business_user_id)) : null;
        return { ...a, project, business };
      });
  }
  if (path.startsWith('/applications/') && M === 'PUT') {
    const user = requireUser(db, config);
    if (user.user_type !== 'business') throw new ApiError(403, 'Only business users can update application status');
    const id = path.split('/').pop();
    const application = db.applications.find((a) => a.id === id);
    if (!application) throw new ApiError(404, 'Application not found');
    const project = db.projects.find((p) => p.id === application.project_id);
    if (!project || project.business_user_id !== user.id)
      throw new ApiError(403, 'Not authorized to update this application');
    application.status = body.status;
    if (body.status === 'accepted') project.status = 'in_progress';
    return { message: `Application ${body.status}` };
  }
  if (path.startsWith('/applications/') && M === 'DELETE') {
    const user = requireUser(db, config);
    if (user.user_type !== 'creative') throw new ApiError(403, 'Only writers can withdraw applications');
    const id = path.split('/').pop();
    const application = db.applications.find((a) => a.id === id);
    if (!application) throw new ApiError(404, 'Application not found');
    if (application.writer_user_id !== user.id) throw new ApiError(403, 'Not authorized');
    if (application.status !== 'pending') throw new ApiError(400, 'Can only withdraw pending applications');
    db.applications = db.applications.filter((a) => a.id !== id);
    return { message: 'Application withdrawn successfully' };
  }

  if (path === '/health' && M === 'GET') {
    return { status: 'ok', database: 'demo' };
  }

  throw new ApiError(404, `Not found: ${M} ${path}`);
}

export function installDemoBackend(axiosInstance) {
  axiosInstance.defaults.adapter = async (config) => {
    const db = loadDb();
    seed(db);

    // Resolve the path relative to the /api base.
    let url = config.url || '';
    url = url.replace(/^https?:\/\/[^/]+/, '');
    url = url.replace(/^\/api/, '');
    const path = url.split('?')[0];

    // Parse the request body.
    let body = config.data;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    // Simulate a little latency so loading states are exercised.
    await new Promise((r) => setTimeout(r, 60));

    try {
      const result = await handle(db, config.method || 'get', path, body, config);
      saveDb(db);
      if (result && result.__blob) {
        return {
          data: result.__blob,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': result.__blob.type },
          config,
          request: {},
        };
      }
      return {
        data: result,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config,
        request: {},
      };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      const detail = err instanceof ApiError ? err.detail : 'Demo error: ' + err.message;
      // Persist any partial mutations that happened before the error is rare;
      // keep the store consistent by not saving on error.
      const axiosError = new Error(detail);
      axiosError.isAxiosError = true;
      axiosError.config = config;
      axiosError.response = {
        data: { detail },
        status,
        statusText: 'Error',
        headers: {},
        config,
      };
      throw axiosError;
    }
  };
}
