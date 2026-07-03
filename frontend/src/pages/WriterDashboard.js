import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { 
  Feather, Sparkles, Upload, FileText, User, MapPin, Briefcase, Settings, 
  HelpCircle, ChevronDown, LogOut, Clock, CheckCircle, XCircle, Send,
  BookOpen, PenTool, Award, TrendingUp, DollarSign, Calendar, Building2,
  Paperclip, X as XIcon, File as FileIcon, CreditCard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

function WriterDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [samples, setSamples] = useState([]);
  const [projects, setProjects] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  // Restore tab from sessionStorage (persists across navigations)
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('writerDashboardTab') || 'overview';
  });
  const [applyingTo, setApplyingTo] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Persist tab + scroll position
  const handleTabChange = useCallback((tab) => {
    sessionStorage.setItem('writerDashboardTab', tab);
    setActiveTab(tab);
  }, []);

  // Save scroll position continuously (so it's always up-to-date before navigation)
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem('writerDashboardScroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener('scroll', saveScroll);
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, []);

  // Restore scroll position on mount
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('writerDashboardScroll');
    if (savedScroll) {
      // Use multiple attempts to ensure DOM is ready
      const scrollTo = parseInt(savedScroll, 10);
      const tryScroll = (attempts) => {
        window.scrollTo(0, scrollTo);
        if (attempts > 0 && window.scrollY !== scrollTo) {
          requestAnimationFrame(() => tryScroll(attempts - 1));
        }
      };
      // Small delay to let the DOM render first, then retry
      const timer = setTimeout(() => tryScroll(10), 50);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Profile form
  const [profileForm, setProfileForm] = useState({
    bio: '',
    genres: [],
    experience_level: 'intermediate',
    location: '',
    languages: [],
    portfolio_links: []
  });

  // Sample form
  const [sampleForm, setSampleForm] = useState({
    title: '',
    content: '',
    genre: '',
    format: 'short_story',
    price_credits: 1
  });

  useEffect(() => {
    loadProfile();
    loadSamples();
    loadProjects();
    loadMyApplications();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await axiosInstance.get('/writers/profile');
      setProfile(data);
      setProfileForm({
        bio: data.bio || '',
        genres: data.genres || [],
        experience_level: data.experience_level || 'intermediate',
        location: data.location || '',
        languages: data.languages || [],
        portfolio_links: data.portfolio_links || []
      });
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const loadSamples = async () => {
    try {
      const { data } = await axiosInstance.get('/writers/samples');
      setSamples(data);
    } catch (error) {
      console.error('Samples load error:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const { data } = await axiosInstance.get('/projects');
      setProjects(data);
    } catch (error) {
      console.error('Projects load error:', error);
    }
  };

  const loadMyApplications = async () => {
    try {
      const { data } = await axiosInstance.get('/applications/my');
      setMyApplications(data);
    } catch (error) {
      console.error('Applications load error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
      localStorage.removeItem('auth_token');
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.put('/writers/profile', profileForm);
      toast.success('Profile updated!');
      loadProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleSampleUpload = async (e) => {
    e.preventDefault();
    try {
      if (uploadedFile) {
        // Upload with file
        const formData = new FormData();
        formData.append('title', sampleForm.title);
        formData.append('genre', sampleForm.genre);
        formData.append('format', sampleForm.format);
        formData.append('price_credits', sampleForm.price_credits || 1);
        formData.append('file', uploadedFile);
        await axiosInstance.post('/writers/samples/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Upload with text content
        await axiosInstance.post('/writers/samples', {
          ...sampleForm,
          price_credits: sampleForm.price_credits || 1
        });
      }
      toast.success('Sample uploaded!');
      setSampleForm({ title: '', content: '', genre: '', format: 'short_story', price_credits: 1 });
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadSamples();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload sample');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error('Only PDF, DOC, DOCX, and TXT files are allowed');
      e.target.value = '';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      e.target.value = '';
      return;
    }
    
    setUploadedFile(file);
    // Auto-fill title from filename if empty
    if (!sampleForm.title) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      setSampleForm(prev => ({ ...prev, title: nameWithoutExt }));
    }
    toast.success(`File "${file.name}" selected`);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteSample = async (sampleId) => {
    try {
      await axiosInstance.delete(`/writers/samples/${sampleId}`);
      toast.success('Sample deleted');
      loadSamples();
    } catch (error) {
      toast.error('Failed to delete sample');
    }
  };

  const handleApply = async () => {
    if (!applyingTo) return;
    setApplying(true);
    try {
      await axiosInstance.post('/applications', {
        project_id: applyingTo.id,
        cover_letter: coverLetter
      });
      toast.success('Application submitted successfully! 🎉');
      setApplyingTo(null);
      setCoverLetter('');
      loadMyApplications();
      loadProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async (applicationId) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;
    setWithdrawing(applicationId);
    try {
      await axiosInstance.delete(`/applications/${applicationId}`);
      toast.success('Application withdrawn');
      loadMyApplications();
      loadProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to withdraw application');
    } finally {
      setWithdrawing(null);
    }
  };

  const hasApplied = (projectId) => {
    return myApplications.some(app => app.project_id === projectId);
  };

  const getApplicationStatus = (projectId) => {
    const app = myApplications.find(a => a.project_id === projectId);
    return app ? app.status : null;
  };

  const addGenre = (genre) => {
    if (!profileForm.genres.includes(genre)) {
      setProfileForm({ ...profileForm, genres: [...profileForm.genres, genre] });
    }
  };

  const removeGenre = (genre) => {
    setProfileForm({ ...profileForm, genres: profileForm.genres.filter(g => g !== genre) });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <Feather className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Word Up
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-orange-50">
                  <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center shadow-md">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium hidden sm:block">{user.name}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account')} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Account Info
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/help')} className="cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600" data-testid="logout-button">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome back, {user.name.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-600">Manage your profile, showcase your work, and find exciting opportunities.</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex w-full h-auto mb-8 bg-white/60 backdrop-blur-sm p-1.5 rounded-xl overflow-x-auto no-scrollbar" style={{ display: 'flex', flexWrap: 'nowrap' }}>
            <TabsTrigger value="overview" className="flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md">
              Overview
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile" className="flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md">
              Profile
            </TabsTrigger>
            <TabsTrigger value="samples" data-testid="tab-samples" className="flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md">
              Samples ({samples.length}/2)
            </TabsTrigger>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities" className="flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md">
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="applications" className="flex-none whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md">
              Applications
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* Stats Cards */}
              <Card className="p-6 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <FileText className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{samples.length}/2</span>
                </div>
                <h3 className="font-semibold text-lg">Writing Samples</h3>
                <p className="text-sm opacity-80">Upload samples to get noticed</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Briefcase className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{projects.length}</span>
                </div>
                <h3 className="font-semibold text-lg">Available Projects</h3>
                <p className="text-sm opacity-80">Opportunities waiting for you</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Send className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{myApplications.length}</span>
                </div>
                <h3 className="font-semibold text-lg">Applications Sent</h3>
                <p className="text-sm opacity-80">Track your progress</p>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card 
                className="p-5 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-orange-200"
                onClick={() => setActiveTab('profile')}
              >
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Edit Profile</h3>
                <p className="text-sm text-gray-600">Update your bio and skills</p>
              </Card>

              <Card 
                className="p-5 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-purple-200"
                onClick={() => setActiveTab('samples')}
              >
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Upload Sample</h3>
                <p className="text-sm text-gray-600">Showcase your writing</p>
              </Card>

              <Card 
                className="p-5 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-blue-200"
                onClick={() => setActiveTab('opportunities')}
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Find Work</h3>
                <p className="text-sm text-gray-600">Browse opportunities</p>
              </Card>

              <Card 
                className="p-5 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-green-200"
                onClick={() => setActiveTab('applications')}
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Track Applications</h3>
                <p className="text-sm text-gray-600">View your status</p>
              </Card>
            </div>

            {/* Recent Opportunities Preview */}
            <Card className="p-6 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  Latest Opportunities
                </h3>
                <Button variant="ghost" onClick={() => setActiveTab('opportunities')} className="text-orange-600">
                  View All →
                </Button>
              </div>
              {projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No opportunities yet. Check back soon!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 3).map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <h4 className="font-semibold">{project.title}</h4>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{project.genre}</Badge>
                          {project.budget_range && <Badge variant="outline">{project.budget_range}</Badge>}
                        </div>
                      </div>
                      {hasApplied(project.id) ? (
                        getStatusBadge(getApplicationStatus(project.id))
                      ) : (
                        <Button 
                          size="sm" 
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => setApplyingTo(project)}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Your Writer Profile</h3>
                  <p className="text-sm text-gray-600">Make a great first impression</p>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <Label htmlFor="bio" className="text-base font-semibold">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself, your writing style, and what makes you unique..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    rows={4}
                    className="mt-2 resize-none"
                    data-testid="profile-bio-input"
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold">Genres</Label>
                  <div className="flex flex-wrap gap-2 my-2">
                    {profileForm.genres.map((genre) => (
                      <Badge key={genre} variant="secondary" className="cursor-pointer hover:bg-red-100 px-3 py-1" onClick={() => removeGenre(genre)}>
                        {genre} ×
                      </Badge>
                    ))}
                    {profileForm.genres.length === 0 && (
                      <span className="text-sm text-gray-400">No genres selected</span>
                    )}
                  </div>
                  <Select onValueChange={addGenre}>
                    <SelectTrigger data-testid="genre-select" className="w-full md:w-64">
                      <SelectValue placeholder="+ Add genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiction">Fiction</SelectItem>
                      <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
                      <SelectItem value="Screenplay">Screenplay</SelectItem>
                      <SelectItem value="Poetry">Poetry</SelectItem>
                      <SelectItem value="Technical">Technical</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Blog">Blog Writing</SelectItem>
                      <SelectItem value="Copywriting">Copywriting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="experience" className="text-base font-semibold">Experience Level</Label>
                    <Select value={profileForm.experience_level} onValueChange={(val) => setProfileForm({ ...profileForm, experience_level: val })}>
                      <SelectTrigger id="experience" data-testid="experience-select" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novice">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            Novice (0-2 years)
                          </div>
                        </SelectItem>
                        <SelectItem value="intermediate">
                          <div className="flex items-center gap-2">
                            <PenTool className="w-4 h-4" />
                            Intermediate (2-5 years)
                          </div>
                        </SelectItem>
                        <SelectItem value="professional">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            Professional (5+ years)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-base font-semibold">Location</Label>
                    <div className="relative mt-2">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="location"
                        placeholder="City, Country"
                        value={profileForm.location}
                        onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                        className="pl-10"
                        data-testid="profile-location-input"
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg" data-testid="save-profile-button">
                  Save Profile
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Samples Tab */}
          <TabsContent value="samples">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Upload Sample</h3>
                    <p className="text-sm text-gray-600">Showcase your best work</p>
                  </div>
                </div>

                <form onSubmit={handleSampleUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="sample-title">Title</Label>
                    <Input
                      id="sample-title"
                      value={sampleForm.title}
                      onChange={(e) => setSampleForm({ ...sampleForm, title: e.target.value })}
                      placeholder="Give your sample a catchy title"
                      required
                      className="mt-1"
                      data-testid="sample-title-input"
                    />
                  </div>

                  {/* File Upload Area */}
                  <div>
                    <Label>Upload a File</Label>
                    <div className="mt-1 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-purple-400 transition-colors">
                      {uploadedFile ? (
                        <div className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileIcon className="w-8 h-8 text-purple-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
                              <p className="text-xs text-gray-500">
                                {(uploadedFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={removeFile} className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <XIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="cursor-pointer py-4"
                        >
                          <Paperclip className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm font-medium text-gray-700">
                            Tap to choose a file from your device
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PDF, DOC, DOCX, or TXT only (max 10MB)
                          </p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  {!uploadedFile && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-xs text-gray-400 font-medium">OR PASTE TEXT</span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                  )}

                  {/* Text Content - only show if no file uploaded */}
                  {!uploadedFile && (
                    <div>
                      <Label htmlFor="sample-content">Content</Label>
                      <Textarea
                        id="sample-content"
                        value={sampleForm.content}
                        onChange={(e) => setSampleForm({ ...sampleForm, content: e.target.value })}
                        rows={8}
                        placeholder="Paste your writing sample here..."
                        className="mt-1 resize-none"
                        data-testid="sample-content-input"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sample-genre">Genre</Label>
                      <Input
                        id="sample-genre"
                        value={sampleForm.genre}
                        onChange={(e) => setSampleForm({ ...sampleForm, genre: e.target.value })}
                        placeholder="e.g., Fiction"
                        required
                        className="mt-1"
                        data-testid="sample-genre-input"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sample-format">Format</Label>
                      <Select value={sampleForm.format} onValueChange={(val) => setSampleForm({ ...sampleForm, format: val })}>
                        <SelectTrigger id="sample-format" className="mt-1" data-testid="sample-format-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short_story">Short Story</SelectItem>
                          <SelectItem value="screenplay">Screenplay</SelectItem>
                          <SelectItem value="novel">Novel Excerpt</SelectItem>
                          <SelectItem value="blog">Blog Post</SelectItem>
                          <SelectItem value="marketing">Marketing Copy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="sample-price" className="flex items-center gap-1">
                      Price (Credits)
                      <span className="text-xs text-gray-400 font-normal">— businesses pay this to access full content</span>
                    </Label>
                    <Input
                      id="sample-price"
                      type="number"
                      min="1"
                      max="50"
                      value={sampleForm.price_credits}
                      onChange={(e) => setSampleForm({ ...sampleForm, price_credits: parseInt(e.target.value) || 1 })}
                      className="mt-1 w-32"
                      data-testid="sample-price-input"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg" 
                    disabled={samples.length >= 2} 
                    data-testid="upload-sample-button"
                  >
                    {samples.length >= 2 ? 'Maximum samples reached' : 'Upload Sample'}
                  </Button>
                </form>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Your Samples</h3>
                    <p className="text-sm text-gray-600">{samples.length} of 2 samples uploaded</p>
                  </div>
                </div>

                {samples.length === 0 ? (
                  <Card className="p-8 bg-white/80 backdrop-blur-sm text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No samples yet. Upload your first writing sample!</p>
                  </Card>
                ) : (
                  samples.map((sample) => (
                    <Card key={sample.id} className="p-5 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-lg">{sample.title}</h4>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteSample(sample.id)} data-testid={`delete-sample-${sample.id}`}>
                          Delete
                        </Button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <Badge className="bg-purple-100 text-purple-700">{sample.genre}</Badge>
                        <Badge variant="outline">{sample.format}</Badge>
                        {sample.price_credits && (
                          <Badge className="bg-green-100 text-green-700">
                            <CreditCard className="w-3 h-3 mr-1" />{sample.price_credits} credit{sample.price_credits !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {sample.pdf_filename && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {sample.pdf_filename.split('.').pop().toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {sample.pdf_url ? (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <FileIcon className="w-6 h-6 text-purple-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{sample.pdf_filename || 'Uploaded File'}</p>
                            {sample.pdf_size && (
                              <p className="text-xs text-gray-500">{(sample.pdf_size / 1024).toFixed(1)} KB</p>
                            )}
                          </div>
                          <a
                            href={`${axiosInstance.defaults.baseURL.replace('/api', '')}${sample.pdf_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium flex-shrink-0"
                          >
                            Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 line-clamp-3">{sample.content}</p>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Available Opportunities</h3>
                  <p className="text-sm text-gray-600">{projects.length} projects looking for writers</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {projects.length === 0 ? (
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                  <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-xl font-semibold mb-2">No opportunities yet</h4>
                  <p className="text-gray-600">Check back soon for new projects!</p>
                </Card>
              ) : (
                projects.map((project) => (
                  <Card key={project.id} className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-100">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold mb-2 flex items-center gap-2">
                          {project.title}
                        </h4>
                        {project.business_name && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                            <Building2 className="w-4 h-4" />
                            {project.business_name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className="bg-blue-100 text-blue-700">{project.genre}</Badge>
                          {project.budget_range && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {project.budget_range}
                            </Badge>
                          )}
                          {project.deadline && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(project.deadline).toLocaleDateString()}
                            </Badge>
                          )}
                          {project.application_count > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              {project.application_count} applied
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-4">{project.description}</p>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {hasApplied(project.id) ? (
                          <div className="text-center">
                            {getStatusBadge(getApplicationStatus(project.id))}
                            <p className="text-xs text-gray-500 mt-1">Applied</p>
                          </div>
                        ) : (
                          <Button 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg"
                            onClick={() => setApplyingTo(project)}
                            data-testid={`apply-project-${project.id}`}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* My Applications Tab */}
          <TabsContent value="applications">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">My Applications</h3>
                  <p className="text-sm text-gray-600">Track the status of your applications</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {myApplications.length === 0 ? (
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                  <Send className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-xl font-semibold mb-2">No applications yet</h4>
                  <p className="text-gray-600 mb-4">Start applying to opportunities to see them here!</p>
                  <Button onClick={() => setActiveTab('opportunities')} className="bg-gradient-to-r from-orange-500 to-amber-500">
                    Browse Opportunities
                  </Button>
                </Card>
              ) : (
                myApplications.map((application) => (
                  <Card key={application.id} className="p-6 bg-white/80 backdrop-blur-sm shadow-md">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold">{application.project?.title || 'Unknown Project'}</h4>
                          {getStatusBadge(application.status)}
                        </div>
                        {application.business && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                            <Building2 className="w-4 h-4" />
                            {application.business.name}
                          </p>
                        )}
                        {application.project && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary">{application.project.genre}</Badge>
                            {application.project.budget_range && (
                              <Badge variant="outline">{application.project.budget_range}</Badge>
                            )}
                          </div>
                        )}
                        {application.cover_letter && (
                          <div className="bg-gray-50 p-3 rounded-lg mt-2">
                            <p className="text-sm text-gray-600 font-medium mb-1">Your Cover Letter:</p>
                            <p className="text-sm text-gray-700">{application.cover_letter}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {new Date(application.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Apply Dialog */}
      <Dialog open={!!applyingTo} onOpenChange={(open) => !open && setApplyingTo(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Apply to Project</DialogTitle>
            <DialogDescription>
              You're applying to: <span className="font-semibold">{applyingTo?.title}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cover-letter" className="text-base font-semibold">Cover Letter (Optional)</Label>
              <Textarea
                id="cover-letter"
                placeholder="Tell the business why you're a great fit for this project..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
                className="mt-2 resize-none"
              />
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Tip:</strong> A personalized cover letter increases your chances of being selected!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyingTo(null)}>Cancel</Button>
            <Button 
              onClick={handleApply} 
              disabled={applying}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {applying ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WriterDashboard;
