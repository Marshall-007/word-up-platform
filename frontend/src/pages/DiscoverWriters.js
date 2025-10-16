import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { ArrowLeft, X, Heart, User, MapPin, FileText, Sparkles, Building2 } from 'lucide-react';

function DiscoverWriters({ user }) {
  const navigate = useNavigate();
  const [writers, setWriters] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState(null);

  useEffect(() => {
    loadWriters();
  }, []);

  const loadWriters = async () => {
    try {
      const { data } = await axiosInstance.get('/writers/discover');
      setWriters(data);
    } catch (error) {
      toast.error('Failed to load writers');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = (direction) => {
    if (currentIndex >= writers.length) return;
    
    setSwipeDirection(direction);
    
    setTimeout(() => {
      if (direction === 'right') {
        // Like - could send to backend
        const writer = writers[currentIndex];
        toast.success(`Interested in ${writer.user.name}!`);
      }
      
      setCurrentIndex(currentIndex + 1);
      setSwipeDirection(null);
    }, 400);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-xl font-semibold">Loading writers...</div>
      </div>
    );
  }

  const currentWriter = writers[currentIndex];
  const hasMore = currentIndex < writers.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/business/dashboard')} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Discover Writers</h1>
          </div>
          
          <div className="text-sm text-gray-600" data-testid="counter">
            {currentIndex + 1} / {writers.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {!hasMore ? (
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm" data-testid="no-more-writers">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-600" />
            <h3 className="text-2xl font-bold mb-2">You've seen all writers!</h3>
            <p className="text-gray-600 mb-6">Check back later for new talent</p>
            <Button onClick={() => navigate('/business/dashboard')} className="bg-blue-600 hover:bg-blue-700">
              Back to Dashboard
            </Button>
          </Card>
        ) : (
          <div className="relative">
            {/* Instructions */}
            <div className="text-center mb-6">
              <p className="text-gray-600">Swipe left to skip, right to show interest</p>
            </div>

            {/* Writer Card */}
            <div 
              className={`relative ${
                swipeDirection === 'right' ? 'swipe-out-right' : 
                swipeDirection === 'left' ? 'swipe-out-left' : ''
              }`}
              data-testid="writer-card"
            >
              <Card className="bg-white/90 backdrop-blur-lg shadow-2xl overflow-hidden">
                {/* Profile Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                  <div className="flex items-center gap-4">
                    {currentWriter.user.picture ? (
                      <img 
                        src={currentWriter.user.picture} 
                        alt={currentWriter.user.name}
                        className="w-20 h-20 rounded-full border-4 border-white"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                        <User className="w-10 h-10" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold" data-testid="writer-name">{currentWriter.user.name}</h2>
                      <p className="opacity-90" data-testid="writer-email">{currentWriter.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Profile Content */}
                <div className="p-6 space-y-6">
                  {currentWriter.profile && (
                    <>
                      {currentWriter.profile.bio && (
                        <div>
                          <h3 className="font-bold text-lg mb-2">About</h3>
                          <p className="text-gray-700" data-testid="writer-bio">{currentWriter.profile.bio}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        {currentWriter.profile.location && (
                          <div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <MapPin className="w-4 h-4" />
                              <span className="font-semibold">Location</span>
                            </div>
                            <p data-testid="writer-location">{currentWriter.profile.location}</p>
                          </div>
                        )}

                        {currentWriter.profile.experience_level && (
                          <div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <Sparkles className="w-4 h-4" />
                              <span className="font-semibold">Experience</span>
                            </div>
                            <p className="capitalize" data-testid="writer-experience">{currentWriter.profile.experience_level}</p>
                          </div>
                        )}
                      </div>

                      {currentWriter.profile.genres && currentWriter.profile.genres.length > 0 && (
                        <div>
                          <h3 className="font-bold text-lg mb-2">Genres</h3>
                          <div className="flex flex-wrap gap-2">
                            {currentWriter.profile.genres.map((genre, idx) => (
                              <Badge key={idx} variant="secondary" data-testid={`genre-${idx}`}>{genre}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentWriter.profile.languages && currentWriter.profile.languages.length > 0 && (
                        <div>
                          <h3 className="font-bold text-lg mb-2">Languages</h3>
                          <div className="flex flex-wrap gap-2">
                            {currentWriter.profile.languages.map((lang, idx) => (
                              <Badge key={idx} variant="outline" data-testid={`language-${idx}`}>{lang}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Writing Samples */}
                  {currentWriter.samples && currentWriter.samples.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Writing Samples
                      </h3>
                      <div className="space-y-4">
                        {currentWriter.samples.map((sample, idx) => (
                          <Card key={sample.id} className="p-4 bg-gray-50" data-testid={`sample-${idx}`}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold">{sample.title}</h4>
                              <div className="flex gap-2">
                                <Badge variant="secondary">{sample.genre}</Badge>
                                <Badge variant="outline">{sample.format}</Badge>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-4">{sample.content}</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-8 mt-8">
              <Button
                onClick={() => handleSwipe('left')}
                size="lg"
                variant="outline"
                className="w-20 h-20 rounded-full border-4 border-red-500 text-red-500 hover:bg-red-50"
                data-testid="skip-button"
              >
                <X className="w-10 h-10" />
              </Button>

              <Button
                onClick={() => handleSwipe('right')}
                size="lg"
                className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 border-4 border-green-600"
                data-testid="like-button"
              >
                <Heart className="w-10 h-10" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscoverWriters;