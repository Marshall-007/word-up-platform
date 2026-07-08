import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { axiosInstance } from '../App';
import { getErrorMessage } from '../lib/errors';
import { UserAvatar } from '../components/UserAvatar';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Calendar, Shield, Save, Trash2, Camera } from 'lucide-react';

// Resize an image file to a small square data URL so avatars stay lightweight.
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function AccountInfo({ user, setUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name,
        email: user.email
      }));
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data } = await axiosInstance.put('/auth/profile', {
        name: formData.name,
        email: formData.email,
        // Required by the backend only when the email actually changes.
        current_password: formData.currentPassword || undefined
      });
      
      setUser(data);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    
    try {
      const { data } = await axiosInstance.post('/auth/change-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword
      });
      // The server rotates tokens on password change; store the fresh JWT so
      // the current session stays authenticated.
      if (data?.token) {
        localStorage.setItem('auth_token', data.token);
      }

      toast.success('Password changed successfully!');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (user?.user_type === 'creative') {
      navigate('/writer/dashboard');
    } else {
      navigate('/business/dashboard');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setAvatarSaving(true);
    try {
      const picture = await resizeImage(file);
      const { data } = await axiosInstance.put('/auth/profile', { picture });
      setUser(data);
      toast.success('Profile picture updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update picture'));
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarSaving(true);
    try {
      const { data } = await axiosInstance.put('/auth/profile', { picture: '' });
      setUser(data);
      toast.success('Profile picture removed');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove picture'));
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Account Information</h1>
          </div>
          
          <div className="w-32"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Account Overview */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="relative flex-shrink-0 w-20 h-20">
              <UserAvatar
                user={user}
                className="w-20 h-20 rounded-full shadow-md text-2xl"
                gradient="from-blue-400 to-indigo-400"
                textClass="text-2xl"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarSaving}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md disabled:opacity-60"
                aria-label="Change profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold truncate">{user?.name}</h2>
              <p className="text-gray-600 truncate">{user?.email}</p>
              <div className="mt-1 flex items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarSaving}
                  className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-60"
                >
                  {avatarSaving ? 'Saving...' : (user?.picture ? 'Change photo' : 'Add photo')}
                </button>
                {user?.picture && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarSaving}
                    className="text-gray-500 hover:text-red-600 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Account Type</p>
                <p className="font-semibold capitalize">{user?.user_type === 'creative' ? 'Writer' : 'Business'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="font-semibold">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Edit Profile Form */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h3 className="text-xl font-bold mb-4">Edit Profile</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  placeholder="your.email@example.com"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        {/* Change Password Form */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h3 className="text-xl font-bold mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter new password (min 8 characters)"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <Shield className="w-4 h-4 mr-2" />
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-red-200">
          <h3 className="text-xl font-bold mb-2 text-red-600">Danger Zone</h3>
          <p className="text-gray-600 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account,
                  profile, projects, applications, and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await axiosInstance.delete('/auth/account');
                      localStorage.removeItem('auth_token');
                      setUser(null);
                      toast.success('Account deleted successfully. Goodbye!');
                      navigate('/');
                    } catch (error) {
                      toast.error(getErrorMessage(error, 'Failed to delete account'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </div>
  );
}

export default AccountInfo;
