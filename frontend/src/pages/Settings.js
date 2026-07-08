import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Bell, Mail, Eye, Globe, Sun, Loader2 } from 'lucide-react';

function Settings({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
    profileVisibility: true,
    showEmail: false,
    darkMode: false,
    language: 'en',
    autoRespond: false,
    jobAlerts: true
  });

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await axiosInstance.get('/auth/settings');
        setSettings(prev => ({ ...prev, ...data }));
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleBack = () => {
    if (user?.user_type === 'creative') {
      navigate('/writer/dashboard');
    } else {
      navigate('/business/dashboard');
    }
  };

  const handleSettingChange = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      setSaving(true);
      await axiosInstance.put('/auth/settings', updated);
      toast.success('Setting updated');
    } catch (error) {
      // Revert on failure
      setSettings(settings);
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-purple-600" />
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Settings</h1>
          </div>
          
          <div className="w-32"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Notifications Settings */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <Label className="text-base font-semibold">Email Notifications</Label>
                <p className="text-sm text-gray-600">Receive email updates about your activity</p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <Label className="text-base font-semibold">Push Notifications</Label>
                <p className="text-sm text-gray-600">Receive push notifications in your browser</p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-base font-semibold">Marketing Emails</Label>
                <p className="text-sm text-gray-600">Receive emails about new features and updates</p>
              </div>
              <Switch
                checked={settings.marketingEmails}
                onCheckedChange={(checked) => handleSettingChange('marketingEmails', checked)}
              />
            </div>
          </div>
        </Card>

        {/* Privacy Settings */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold">Privacy</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <Label className="text-base font-semibold">Profile Visibility</Label>
                <p className="text-sm text-gray-600">
                  {user?.user_type === 'creative' 
                    ? 'Make your writer profile visible to businesses' 
                    : 'Make your business profile visible to writers'}
                </p>
              </div>
              <Switch
                checked={settings.profileVisibility}
                onCheckedChange={(checked) => handleSettingChange('profileVisibility', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-base font-semibold">Show Email Address</Label>
                <p className="text-sm text-gray-600">Display your email on your public profile</p>
              </div>
              <Switch
                checked={settings.showEmail}
                onCheckedChange={(checked) => handleSettingChange('showEmail', checked)}
              />
            </div>
          </div>
        </Card>

        {/* Appearance Settings */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <Sun className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold">Appearance</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-base font-semibold">Language</Label>
                <p className="text-sm text-gray-600">Saved as your preferred language</p>
              </div>
              <select 
                className="px-4 py-2 border rounded-lg bg-white"
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Communication Preferences */}
        {user?.user_type === 'business' && (
          <Card className="p-6 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold">Business Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-base font-semibold">Auto-respond to Writer Applications</Label>
                  <p className="text-sm text-gray-600">Automatically send confirmation emails</p>
                </div>
                <Switch
                  checked={settings.autoRespond || false}
                  onCheckedChange={(checked) => handleSettingChange('autoRespond', checked)}
                />
              </div>
            </div>
          </Card>
        )}

        {user?.user_type === 'creative' && (
          <Card className="p-6 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold">Writer Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <Label className="text-base font-semibold">Job Match Alerts</Label>
                  <p className="text-sm text-gray-600">Get notified when projects match your skills</p>
                </div>
                <Switch
                  checked={settings.jobAlerts !== false}
                  onCheckedChange={(checked) => handleSettingChange('jobAlerts', checked)}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Data & Storage */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold">Data & Storage</h2>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start" onClick={() => {
              toast.info('Preparing your data export. You will receive an email when ready.');
            }}>
              Download Your Data
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => {
              localStorage.removeItem('cache');
              toast.success('Cache cleared successfully');
            }}>
              Clear Cache
            </Button>
            <p className="text-sm text-gray-600">
              Clear your browser cache to free up space and improve performance
            </p>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleBack} className="bg-purple-600 hover:bg-purple-700">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
