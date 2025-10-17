import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Building2, LogOut, Search, Briefcase, CreditCard, User, Plus, Settings, HelpCircle, ChevronDown } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('profile');
  
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
      toast.success('Project posted!');
      setProjectForm({ title: '', description: '', genre: '', budget_range: '' });
      loadProjects();
    } catch (error) {
      toast.error('Failed to post project');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Word Up Business</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="font-semibold" data-testid="credits-display">{credits} Credits</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">{user.name}</span>
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
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Business Dashboard</h2>
          <p className="text-gray-600">Discover talent, post projects, and manage your opportunities</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card 
            className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer"
            onClick={() => navigate('/discover')}
            data-testid="discover-writers-card"
          >
            <Search className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-bold text-lg mb-1">Discover Writers</h3>
            <p className="text-sm text-gray-600">Browse writer profiles with card swipe</p>
          </Card>

          <Card 
            className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg cursor-pointer"
            onClick={() => setActiveTab('projects')}
            data-testid="post-project-card"
          >
            <Briefcase className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-bold text-lg mb-1">Post Project</h3>
            <p className="text-sm text-gray-600">Share opportunities with writers</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <CreditCard className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg mb-1">{credits} Credits</h3>
            <p className="text-sm opacity-90">View full writer portfolios</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="profile" data-testid="tab-profile">Company Profile</TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">My Projects</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6 bg-white/80 backdrop-blur-sm">
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={profileForm.company_name}
                    onChange={(e) => setProfileForm({ ...profileForm, company_name: e.target.value })}
                    data-testid="company-name-input"
                  />
                </div>

                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={profileForm.industry}
                    onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                    placeholder="e.g., Film Production, Marketing, Publishing"
                    data-testid="industry-input"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Company Description</Label>
                  <Textarea
                    id="description"
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    rows={4}
                    placeholder="Tell writers about your company..."
                    data-testid="description-input"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    placeholder="https://yourcompany.com"
                    data-testid="website-input"
                  />
                </div>

                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="save-profile-button">
                  Save Profile
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Post New Project
                </h3>
                <form onSubmit={handleProjectCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="project-title">Project Title</Label>
                    <Input
                      id="project-title"
                      value={projectForm.title}
                      onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                      required
                      data-testid="project-title-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="project-description">Description</Label>
                    <Textarea
                      id="project-description"
                      value={projectForm.description}
                      onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                      rows={6}
                      required
                      data-testid="project-description-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="project-genre">Genre</Label>
                      <Input
                        id="project-genre"
                        value={projectForm.genre}
                        onChange={(e) => setProjectForm({ ...projectForm, genre: e.target.value })}
                        required
                        data-testid="project-genre-input"
                      />
                    </div>

                    <div>
                      <Label htmlFor="project-budget">Budget Range</Label>
                      <Input
                        id="project-budget"
                        value={projectForm.budget_range}
                        onChange={(e) => setProjectForm({ ...projectForm, budget_range: e.target.value })}
                        placeholder="e.g., $1000-5000"
                        data-testid="project-budget-input"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" data-testid="post-project-button">
                    Post Project
                  </Button>
                </form>
              </Card>

              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Your Projects
                </h3>
                {projects.length === 0 ? (
                  <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                    <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">No projects yet. Create your first one!</p>
                  </Card>
                ) : (
                  projects.map((project) => (
                    <Card key={project.id} className="p-4 bg-white/80 backdrop-blur-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{project.title}</h4>
                        <Badge>{project.status}</Badge>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Badge variant="secondary">{project.genre}</Badge>
                        {project.budget_range && <Badge variant="outline">{project.budget_range}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default BusinessDashboard;