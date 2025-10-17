import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Feather, LogOut, Sparkles, Upload, FileText, User, MapPin, Briefcase, Settings, HelpCircle, ChevronDown } from 'lucide-react';
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
  const [profile, setProfile] = useState(null);
  const [samples, setSamples] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  
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
    format: 'short_story'
  });

  // AI form
  const [aiForm, setAiForm] = useState({
    text: '',
    task: 'grammar',
    tone: 'professional'
  });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadProfile();
    loadSamples();
    loadProjects();
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
      await axiosInstance.post('/writers/samples', sampleForm);
      toast.success('Sample uploaded!');
      setSampleForm({ title: '', content: '', genre: '', format: 'short_story' });
      loadSamples();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload sample');
    }
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

  const handleAIAssist = async (e) => {
    e.preventDefault();
    setAiLoading(true);
    try {
      const { data } = await axiosInstance.post('/ai/assist', aiForm);
      setAiResult(data.result);
      toast.success('AI assistance complete!');
    } catch (error) {
      toast.error('AI assistance failed');
    } finally {
      setAiLoading(false);
    }
  };

  const addGenre = (genre) => {
    if (!profileForm.genres.includes(genre)) {
      setProfileForm({ ...profileForm, genres: [...profileForm.genres, genre] });
    }
  };

  const removeGenre = (genre) => {
    setProfileForm({ ...profileForm, genres: profileForm.genres.filter(g => g !== genre) });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Feather className="w-8 h-8 text-orange-600" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Word Up</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-orange-600" />
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
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Writer Dashboard</h2>
          <p className="text-gray-600">Manage your profile, samples, and explore opportunities</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="samples" data-testid="tab-samples">Samples ({samples.length}/2)</TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai">AI Tools</TabsTrigger>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">Opportunities</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6 bg-white/80 backdrop-blur-sm">
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    rows={4}
                    data-testid="profile-bio-input"
                  />
                </div>

                <div>
                  <Label>Genres</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {profileForm.genres.map((genre) => (
                      <Badge key={genre} variant="secondary" className="cursor-pointer" onClick={() => removeGenre(genre)}>
                        {genre} ×
                      </Badge>
                    ))}
                  </div>
                  <Select onValueChange={addGenre}>
                    <SelectTrigger data-testid="genre-select">
                      <SelectValue placeholder="Add genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiction">Fiction</SelectItem>
                      <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
                      <SelectItem value="Screenplay">Screenplay</SelectItem>
                      <SelectItem value="Poetry">Poetry</SelectItem>
                      <SelectItem value="Technical">Technical</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="experience">Experience Level</Label>
                    <Select value={profileForm.experience_level} onValueChange={(val) => setProfileForm({ ...profileForm, experience_level: val })}>
                      <SelectTrigger id="experience" data-testid="experience-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novice">Novice</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                      data-testid="profile-location-input"
                    />
                  </div>
                </div>

                <Button type="submit" className="bg-orange-600 hover:bg-orange-700" data-testid="save-profile-button">
                  Save Profile
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Samples Tab */}
          <TabsContent value="samples">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Sample
                </h3>
                <form onSubmit={handleSampleUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="sample-title">Title</Label>
                    <Input
                      id="sample-title"
                      value={sampleForm.title}
                      onChange={(e) => setSampleForm({ ...sampleForm, title: e.target.value })}
                      required
                      data-testid="sample-title-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sample-content">Content</Label>
                    <Textarea
                      id="sample-content"
                      value={sampleForm.content}
                      onChange={(e) => setSampleForm({ ...sampleForm, content: e.target.value })}
                      rows={8}
                      required
                      data-testid="sample-content-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sample-genre">Genre</Label>
                      <Input
                        id="sample-genre"
                        value={sampleForm.genre}
                        onChange={(e) => setSampleForm({ ...sampleForm, genre: e.target.value })}
                        required
                        data-testid="sample-genre-input"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sample-format">Format</Label>
                      <Select value={sampleForm.format} onValueChange={(val) => setSampleForm({ ...sampleForm, format: val })}>
                        <SelectTrigger id="sample-format" data-testid="sample-format-select">
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

                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={samples.length >= 2} data-testid="upload-sample-button">
                    Upload Sample
                  </Button>
                </form>
              </Card>

              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Your Samples
                </h3>
                {samples.map((sample) => (
                  <Card key={sample.id} className="p-4 bg-white/80 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg">{sample.title}</h4>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteSample(sample.id)} data-testid={`delete-sample-${sample.id}`}>
                        Delete
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge>{sample.genre}</Badge>
                      <Badge variant="outline">{sample.format}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{sample.content}</p>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* AI Tools Tab */}
          <TabsContent value="ai">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-600" />
                  AI Writing Assistant
                </h3>
                <form onSubmit={handleAIAssist} className="space-y-4">
                  <div>
                    <Label htmlFor="ai-text">Your Text</Label>
                    <Textarea
                      id="ai-text"
                      value={aiForm.text}
                      onChange={(e) => setAiForm({ ...aiForm, text: e.target.value })}
                      rows={6}
                      placeholder="Paste your text here..."
                      required
                      data-testid="ai-text-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ai-task">Task</Label>
                      <Select value={aiForm.task} onValueChange={(val) => setAiForm({ ...aiForm, task: val })}>
                        <SelectTrigger id="ai-task" data-testid="ai-task-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grammar">Grammar Check</SelectItem>
                          <SelectItem value="rewrite">Rewrite</SelectItem>
                          <SelectItem value="tone_adjust">Adjust Tone</SelectItem>
                          <SelectItem value="logline">Create Logline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {aiForm.task === 'tone_adjust' && (
                      <div>
                        <Label htmlFor="ai-tone">Tone</Label>
                        <Select value={aiForm.tone} onValueChange={(val) => setAiForm({ ...aiForm, tone: val })}>
                          <SelectTrigger id="ai-tone" data-testid="ai-tone-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="dramatic">Dramatic</SelectItem>
                            <SelectItem value="humorous">Humorous</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={aiLoading} data-testid="ai-assist-button">
                    {aiLoading ? 'Processing...' : 'Get AI Assistance'}
                  </Button>
                </form>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4">Result</h3>
                {aiResult ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap" data-testid="ai-result">{aiResult}</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-2" />
                    <p>AI results will appear here</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            <div className="grid gap-4">
              {projects.length === 0 ? (
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
                  <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No opportunities yet. Check back soon!</p>
                </Card>
              ) : (
                projects.map((project) => (
                  <Card key={project.id} className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg">
                    <h4 className="text-xl font-bold mb-2">{project.title}</h4>
                    <div className="flex gap-2 mb-3">
                      <Badge>{project.genre}</Badge>
                      {project.budget_range && <Badge variant="outline">{project.budget_range}</Badge>}
                    </div>
                    <p className="text-gray-600 mb-4">{project.description}</p>
                    <Button className="bg-orange-600 hover:bg-orange-700" data-testid={`apply-project-${project.id}`}>
                      Apply Now
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default WriterDashboard;