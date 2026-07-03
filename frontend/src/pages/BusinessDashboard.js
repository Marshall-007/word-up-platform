import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { axiosInstance } from '../App';
import { downloadSampleFile } from '../lib/download';
import { toast } from 'sonner';
import {
  Building2, LogOut, Search, Briefcase, CreditCard, User, Plus, Settings,
  HelpCircle, ChevronDown, CheckCircle, XCircle, Clock, MapPin,
  Award, Trash2, Send, Users, ShoppingBag, FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

function BusinessDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [credits, setCredits] = useState(0);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [deletingProject, setDeletingProject] = useState(null);
  const [purchases, setPurchases] = useState([]);
  
  const [profileForm, setProfileForm] = useState({
    company_name: '',
    industry: '',
    description: '',
    website: ''
  });

  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    genre: '',
    budget_range: ''
  });

  useEffect(() => {
    loadProfile();
    loadProjects();
    loadCredits();
    loadApplications();
    loadPurchases();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await axiosInstance.get('/business/profile');
      setProfile(data);
      setProfileForm({
        company_name: data.company_name || '',
        industry: data.industry || '',
        description: data.description || '',
        website: data.website || ''
      });
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const { data } = await axiosInstance.get('/business/projects');
      setProjects(data);
    } catch (error) {
      console.error('Projects load error:', error);
    }
  };

  const loadCredits = async () => {
    try {
      const { data } = await axiosInstance.get('/business/credits');
      setCredits(data.credits);
    } catch (error) {
      console.error('Credits load error:', error);
    }
  };

  const loadApplications = async () => {
    try {
      const { data } = await axiosInstance.get('/business/applications');
      setApplications(data);
    } catch (error) {
      console.error('Applications load error:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      const { data } = await axiosInstance.get('/business/purchases');
      setPurchases(data);
    } catch (error) {
      console.error('Purchases load error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } catch (error) {
      // Even if the server call fails, always clear local auth state so the
      // user is never stuck "logged in" on a dead session.
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      navigate('/');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.put('/business/profile', profileForm);
      toast.success('Profile updated!');
      loadProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleProjectCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/business/projects', projectForm);
      toast.success('Project posted successfully! 🎉');
      setProjectForm({ title: '', description: '', genre: '', budget_range: '' });
      loadProjects();
    } catch (error) {
      toast.error('Failed to post project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await axiosInstance.delete(`/business/projects/${projectId}`);
      toast.success('Project deleted');
      setDeletingProject(null);
      loadProjects();
      loadApplications();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleApplicationAction = async (applicationId, status) => {
    try {
      await axiosInstance.put(`/applications/${applicationId}`, { status });
      toast.success(`Application ${status}!`);
      loadApplications();
      loadProjects();
    } catch (error) {
      toast.error(`Failed to ${status} application`);
    }
  };

  const handleCloseProject = async (projectId) => {
    try {
      await axiosInstance.put(`/business/projects/${projectId}`, { status: 'completed' });
      toast.success('Project marked as completed');
      loadProjects();
    } catch (error) {
      toast.error('Failed to update project');
    }
  };

  const handleReopenProject = async (projectId) => {
    try {
      await axiosInstance.put(`/business/projects/${projectId}`, { status: 'open' });
      toast.success('Project reopened');
      loadProjects();
    } catch (error) {
      toast.error('Failed to reopen project');
    }
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

  const getProjectStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-100 text-green-700">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-700">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProjectApplications = (projectId) => {
    return applications.filter(app => app.project_id === projectId);
  };

  const pendingApps = applications.filter(a => a.status === 'pending');
  const acceptedApps = applications.filter(a => a.status === 'accepted');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Word Up Business</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="font-semibold" data-testid="credits-display">{credits} Credits</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-blue-50">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full flex items-center justify-center shadow-md">
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome back, {user.name.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-600">Discover talent, post projects, and manage your opportunities</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-8 bg-white/60 backdrop-blur-sm p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              Profile
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              Projects
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              Applications {pendingApps.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pendingApps.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="purchased" data-testid="tab-purchased" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
              Purchased {purchases.length > 0 && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5">{purchases.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="p-6 bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Briefcase className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{projects.length}</span>
                </div>
                <h3 className="font-semibold text-lg">Projects</h3>
                <p className="text-sm opacity-80">Total posted</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Send className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{applications.length}</span>
                </div>
                <h3 className="font-semibold text-lg">Applications</h3>
                <p className="text-sm opacity-80">Total received</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{pendingApps.length}</span>
                </div>
                <h3 className="font-semibold text-lg">Pending Review</h3>
                <p className="text-sm opacity-80">Need your attention</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <CreditCard className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{credits}</span>
                </div>
                <h3 className="font-semibold text-lg">Credits</h3>
                <p className="text-sm opacity-80">Available balance</p>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-blue-200" onClick={() => navigate('/discover')} data-testid="discover-writers-card">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Discover Writers</h3>
                <p className="text-sm text-gray-600">Browse writer profiles and portfolios</p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-purple-200" onClick={() => setActiveTab('projects')} data-testid="post-project-card">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Post a Project</h3>
                <p className="text-sm text-gray-600">Share new opportunities with writers</p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-green-200" onClick={() => setActiveTab('applications')}>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Review Applications</h3>
                <p className="text-sm text-gray-600">{pendingApps.length > 0 ? `${pendingApps.length} pending review` : 'All caught up!'}</p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 border-2 border-transparent hover:border-cyan-200" onClick={() => setActiveTab('purchased')}>
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-3">
                  <ShoppingBag className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="font-bold text-lg mb-1">Purchased Samples</h3>
                <p className="text-sm text-gray-600">{purchases.length > 0 ? `${purchases.length} sample${purchases.length !== 1 ? 's' : ''} acquired` : 'Buy writer material'}</p>
              </Card>
            </div>

            {/* Pending Applications Preview */}
            {pendingApps.length > 0 && (
              <Card className="p-6 bg-white/80 backdrop-blur-sm mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    Pending Applications
                  </h3>
                  <Button variant="ghost" onClick={() => setActiveTab('applications')} className="text-blue-600">View All →</Button>
                </div>
                <div className="space-y-3">
                  {pendingApps.slice(0, 3).map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{app.writer?.name || 'Unknown Writer'}</h4>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm text-gray-600">{app.project?.title || 'Unknown Project'}</span>
                        </div>
                        {app.writer_profile?.experience_level && (
                          <p className="text-xs text-gray-500 mt-1 capitalize">{app.writer_profile.experience_level} writer</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleApplicationAction(app.id, 'accepted')}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleApplicationAction(app.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Company Profile</h3>
                  <p className="text-sm text-gray-600">Help writers learn about your company</p>
                </div>
              </div>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input id="company_name" value={profileForm.company_name} onChange={(e) => setProfileForm({ ...profileForm, company_name: e.target.value })} className="mt-1" data-testid="company-name-input" />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" value={profileForm.industry} onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })} placeholder="e.g., Film Production, Marketing, Publishing" className="mt-1" data-testid="industry-input" />
                </div>
                <div>
                  <Label htmlFor="description">Company Description</Label>
                  <Textarea id="description" value={profileForm.description} onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })} rows={4} placeholder="Tell writers about your company..." className="mt-1 resize-none" data-testid="description-input" />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" type="url" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://yourcompany.com" className="mt-1" data-testid="website-input" />
                </div>
                <Button type="submit" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg" data-testid="save-profile-button">Save Profile</Button>
              </form>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Post New Project</h3>
                    <p className="text-sm text-gray-600">Attract talented writers</p>
                  </div>
                </div>
                <form onSubmit={handleProjectCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="project-title">Project Title</Label>
                    <Input id="project-title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="e.g., Sci-Fi Screenplay for Feature Film" required className="mt-1" data-testid="project-title-input" />
                  </div>
                  <div>
                    <Label htmlFor="project-description">Description</Label>
                    <Textarea id="project-description" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={6} placeholder="Describe the project, requirements, and what you're looking for..." required className="mt-1 resize-none" data-testid="project-description-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="project-genre">Genre</Label>
                      <Input id="project-genre" value={projectForm.genre} onChange={(e) => setProjectForm({ ...projectForm, genre: e.target.value })} placeholder="e.g., Sci-Fi, Drama" required className="mt-1" data-testid="project-genre-input" />
                    </div>
                    <div>
                      <Label htmlFor="project-budget">Budget Range</Label>
                      <Input id="project-budget" value={projectForm.budget_range} onChange={(e) => setProjectForm({ ...projectForm, budget_range: e.target.value })} placeholder="e.g., $1,000 - $5,000" className="mt-1" data-testid="project-budget-input" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg" data-testid="post-project-button">
                    <Plus className="w-4 h-4 mr-2" /> Post Project
                  </Button>
                </form>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Your Projects</h3>
                    <p className="text-sm text-gray-600">{projects.length} project{projects.length !== 1 ? 's' : ''} posted</p>
                  </div>
                </div>
                {projects.length === 0 ? (
                  <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                    <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h4 className="text-xl font-semibold mb-2">No projects yet</h4>
                    <p className="text-gray-600">Create your first project to start attracting writers!</p>
                  </Card>
                ) : (
                  projects.map((project) => {
                    const appCount = getProjectApplications(project.id).length;
                    return (
                      <Card key={project.id} className="p-5 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-lg">{project.title}</h4>
                          {getProjectStatusBadge(project.status)}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="secondary">{project.genre}</Badge>
                          {project.budget_range && <Badge variant="outline">{project.budget_range}</Badge>}
                          {(appCount > 0 || project.application_count > 0) && (
                            <Badge className="bg-blue-100 text-blue-700 cursor-pointer" onClick={() => setActiveTab('applications')}>
                              <Users className="w-3 h-3 mr-1" />{appCount || project.application_count} applicant{(appCount || project.application_count) > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{project.description}</p>
                        <div className="flex gap-2">
                          {project.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => handleCloseProject(project.id)}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Mark Complete
                            </Button>
                          )}
                          {(project.status === 'completed' || project.status === 'in_progress') && (
                            <Button size="sm" variant="outline" onClick={() => handleReopenProject(project.id)}>Reopen</Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeletingProject(project)}>
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Writer Applications</h3>
                  <p className="text-sm text-gray-600">{applications.length} total · {pendingApps.length} pending · {acceptedApps.length} accepted</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {applications.length === 0 ? (
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-xl font-semibold mb-2">No applications yet</h4>
                  <p className="text-gray-600 mb-4">Post a project to start receiving applications from writers!</p>
                  <Button onClick={() => setActiveTab('projects')} className="bg-gradient-to-r from-blue-500 to-indigo-500">
                    <Plus className="w-4 h-4 mr-2" /> Post a Project
                  </Button>
                </Card>
              ) : (
                applications.map((app) => (
                  <Card key={app.id} className={`p-6 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow ${
                    app.status === 'pending' ? 'border-l-4 border-l-yellow-400' : 
                    app.status === 'accepted' ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-gray-300'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{app.writer?.name || 'Unknown Writer'}</h4>
                            <p className="text-sm text-gray-500">{app.writer?.email}</p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>

                        {app.writer_profile && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {app.writer_profile.experience_level && (
                              <Badge variant="outline" className="capitalize"><Award className="w-3 h-3 mr-1" />{app.writer_profile.experience_level}</Badge>
                            )}
                            {app.writer_profile.location && (
                              <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{app.writer_profile.location}</Badge>
                            )}
                            {app.writer_profile.genres?.map(g => (
                              <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                            ))}
                          </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded-lg mb-3">
                          <p className="text-xs text-gray-500 font-medium mb-1">Applied to:</p>
                          <p className="font-semibold">{app.project?.title || 'Unknown Project'}</p>
                          {app.project?.genre && <Badge variant="secondary" className="mt-1 text-xs">{app.project.genre}</Badge>}
                        </div>

                        {app.cover_letter && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-600 font-medium mb-1">Cover Letter:</p>
                            <p className="text-sm text-gray-700">{app.cover_letter}</p>
                          </div>
                        )}

                        {app.writer_profile?.bio && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 font-medium mb-1">Bio:</p>
                            <p className="text-sm text-gray-600">{app.writer_profile.bio}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {app.status === 'pending' && (
                          <>
                            <Button className="bg-green-500 hover:bg-green-600 text-white w-full" onClick={() => handleApplicationAction(app.id, 'accepted')}>
                              <CheckCircle className="w-4 h-4 mr-2" /> Accept
                            </Button>
                            <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 w-full" onClick={() => handleApplicationAction(app.id, 'rejected')}>
                              <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                          </>
                        )}
                        {app.status === 'accepted' && (
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                            <p className="text-sm font-medium text-green-700">Accepted</p>
                          </div>
                        )}
                        {app.status === 'rejected' && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <XCircle className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-sm font-medium text-gray-500">Rejected</p>
                          </div>
                        )}
                        <p className="text-xs text-center text-gray-400">{new Date(app.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Purchased Samples Tab */}
          <TabsContent value="purchased">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Purchased Writing Samples</h3>
                  <p className="text-sm text-gray-600">{purchases.length} sample{purchases.length !== 1 ? 's' : ''} purchased</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {purchases.length === 0 ? (
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                  <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-xl font-semibold mb-2">No purchases yet</h4>
                  <p className="text-gray-600 mb-4">Discover writers and purchase their samples to access full content.</p>
                  <Button onClick={() => navigate('/discover')} className="bg-gradient-to-r from-blue-500 to-indigo-500">
                    <Search className="w-4 h-4 mr-2" /> Discover Writers
                  </Button>
                </Card>
              ) : (
                purchases.map((purchase) => (
                  <Card key={purchase.id} className="p-6 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-blue-400">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{purchase.sample?.title || 'Untitled Sample'}</h4>
                            <p className="text-sm text-gray-500">by {purchase.writer?.name || 'Unknown Writer'}</p>
                          </div>
                        </div>

                        {purchase.sample && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary">{purchase.sample.genre}</Badge>
                            <Badge variant="outline">{purchase.sample.format}</Badge>
                            <Badge className="bg-blue-100 text-blue-700">
                              <CreditCard className="w-3 h-3 mr-1" />{purchase.credits_spent} credit{purchase.credits_spent !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}

                        {purchase.sample?.content && (
                          <div className="bg-gray-50 p-4 rounded-lg mb-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">{purchase.sample.content}</p>
                          </div>
                        )}

                        {purchase.sample?.pdf_url && (
                          <button
                            type="button"
                            onClick={() => downloadSampleFile(purchase.sample.pdf_url, purchase.sample.pdf_filename).catch(() => toast.error('Download failed'))}
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-2 rounded-lg"
                          >
                            <FileText className="w-4 h-4" />
                            Download File ({purchase.sample.pdf_filename || 'file'})
                          </button>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{new Date(purchase.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Project Dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-600">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "<span className="font-semibold">{deletingProject?.title}</span>"? This will also remove all applications. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDeleteProject(deletingProject?.id)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BusinessDashboard;