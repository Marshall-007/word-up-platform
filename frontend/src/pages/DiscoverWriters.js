import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { axiosInstance } from '../App';
import { downloadSampleFile } from '../lib/download';
import { toast } from 'sonner';
import { ArrowLeft, X, Heart, User, MapPin, FileText, Sparkles, Building2, CreditCard, ShoppingCart, Check, Lock } from 'lucide-react';

function DiscoverWriters({ user }) {
  const navigate = useNavigate();
  const [writers, setWriters] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [credits, setCredits] = useState(0);
  const [purchasedSamples, setPurchasedSamples] = useState(new Set());
  const [purchasedFull, setPurchasedFull] = useState({}); // sampleId -> full sample (content + file)
  const [buyingDialog, setBuyingDialog] = useState(null); // sample object
  const [buying, setBuying] = useState(false);
  const [viewingSample, setViewingSample] = useState(null); // purchased sample to view full content

  useEffect(() => {
    loadWriters();
    loadCredits();
    loadPurchases();
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

  const loadCredits = async () => {
    try {
      const { data } = await axiosInstance.get('/business/credits');
      setCredits(data.credits);
    } catch (error) {
      console.error('Credits load error:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      const { data } = await axiosInstance.get('/business/purchases');
      const ids = new Set(data.map(p => p.sample_id));
      setPurchasedSamples(ids);
      // Keep the full (unredacted) purchased samples so discover cards can show
      // real content + the download link instead of the locked preview.
      const fullMap = {};
      data.forEach(p => { if (p.sample) fullMap[p.sample_id] = p.sample; });
      setPurchasedFull(fullMap);
    } catch (error) {
      console.error('Purchases load error:', error);
    }
  };

  const handlePurchaseSample = async (sample) => {
    setBuying(true);
    try {
      const { data } = await axiosInstance.post('/business/purchase-sample', {
        sample_id: sample.id
      });
      toast.success(`Sample purchased! ${data.credits_remaining} credits remaining.`);
      setCredits(data.credits_remaining);
      setPurchasedSamples(prev => new Set([...prev, sample.id]));
      // Cache the full sample so the card unlocks content + download in place.
      if (data.sample) {
        setPurchasedFull(prev => ({ ...prev, [sample.id]: data.sample }));
      }
      setBuyingDialog(null);
      // Show the full sample immediately
      setViewingSample(data.sample);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to purchase sample');
    } finally {
      setBuying(false);
    }
  };

  const handleSwipe = (direction) => {
    if (currentIndex >= writers.length) return;
    
    setSwipeDirection(direction);
    
    setTimeout(() => {
      if (direction === 'right') {
        const writer = writers[currentIndex];
        toast.success(`Interested in ${writer.user.name}!`);
      }
      
      setCurrentIndex(currentIndex + 1);
      setSwipeDirection(null);
    }, 400);
  };

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = currentTouch - touchStart;
    setDragOffset(diff);
    setTouchEnd(currentTouch);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    setIsDragging(false);
    setDragOffset(0);

    if (isLeftSwipe) {
      handleSwipe('left');
    } else if (isRightSwipe) {
      handleSwipe('right');
    }
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
            Back
          </Button>
          
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Discover Writers</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full text-sm">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold">{credits}</span>
            </div>
            <div className="text-sm text-gray-600" data-testid="counter">
              {currentIndex + 1} / {writers.length}
            </div>
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
            <div className="text-center mb-6">
              <p className="text-gray-600">Swipe left to skip, right to show interest</p>
            </div>

            {/* Writer Card */}
            <div 
              className={`relative transition-transform ${
                swipeDirection === 'right' ? 'swipe-out-right' : 
                swipeDirection === 'left' ? 'swipe-out-left' : ''
              }`}
              style={{
                transform: isDragging ? `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)` : 'none',
                transition: isDragging ? 'none' : 'transform 0.3s ease',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'pan-y',
                userSelect: 'none'
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              data-testid="writer-card"
            >
              <Card className="bg-white/90 backdrop-blur-lg shadow-2xl overflow-hidden">
                {/* Swipe Overlay Indicators */}
                {isDragging && (
                  <>
                    {dragOffset > 50 && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10 pointer-events-none">
                        <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-xl transform rotate-12">
                          <Heart className="w-8 h-8" />
                        </div>
                      </div>
                    )}
                    {dragOffset < -50 && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 pointer-events-none">
                        <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-xl transform -rotate-12">
                          <X className="w-8 h-8" />
                        </div>
                      </div>
                    )}
                  </>
                )}
                
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
                      <p className="opacity-90" data-testid="writer-email">
                        {currentWriter.user.email || 'Email hidden by writer'}
                      </p>
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

                  {/* Writing Samples - with Purchase flow */}
                  {currentWriter.samples && currentWriter.samples.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Writing Samples
                      </h3>
                      <div className="space-y-4">
                        {currentWriter.samples.map((sample, idx) => {
                          const isPurchased = purchasedSamples.has(sample.id);
                          // Once purchased, prefer the full (unredacted) sample.
                          const displaySample = (isPurchased && purchasedFull[sample.id]) || sample;
                          const cost = sample.price_credits || 1;
                          return (
                            <Card key={sample.id} className="p-4 bg-gray-50 border" data-testid={`sample-${idx}`}>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold">{sample.title}</h4>
                                <div className="flex gap-2">
                                  <Badge variant="secondary">{sample.genre}</Badge>
                                  <Badge variant="outline">{sample.format}</Badge>
                                </div>
                              </div>
                              {/* Show preview (truncated) or full content if purchased */}
                              {isPurchased ? (
                                <div>
                                  <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{displaySample.content}</p>
                                  {displaySample.pdf_url && (
                                    <button
                                      type="button"
                                      onClick={() => downloadSampleFile(displaySample.pdf_url, displaySample.pdf_filename).catch(() => toast.error('Download failed'))}
                                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      <FileText className="w-4 h-4" />
                                      Download Full File
                                    </button>
                                  )}
                                  <Badge className="ml-2 bg-green-100 text-green-700">
                                    <Check className="w-3 h-3 mr-1" />Purchased
                                  </Badge>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm text-gray-400 italic line-clamp-2">
                                    {sample.content ? sample.content.substring(0, 80) + '...' : 'Content preview locked.'}
                                  </p>
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-1 text-sm text-gray-500">
                                      <Lock className="w-3.5 h-3.5" />
                                      Full content locked
                                    </div>
                                    <Button
                                      size="sm"
                                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBuyingDialog(sample);
                                      }}
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                                      Buy ({cost} credit{cost !== 1 ? 's' : ''})
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
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

      {/* Purchase Dialog */}
      <Dialog open={!!buyingDialog} onOpenChange={(open) => !open && setBuyingDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Purchase Writing Sample
            </DialogTitle>
            <DialogDescription>
              Get full access to this writing sample.
            </DialogDescription>
          </DialogHeader>
          
          {buyingDialog && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-bold text-lg">{buyingDialog.title}</h4>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary">{buyingDialog.genre}</Badge>
                  <Badge variant="outline">{buyingDialog.format}</Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="font-semibold">Cost</p>
                  <p className="text-2xl font-bold text-blue-700">{buyingDialog.price_credits || 1} credit{(buyingDialog.price_credits || 1) !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Your balance</p>
                  <p className="text-xl font-bold">{credits} credits</p>
                </div>
              </div>

              {credits < (buyingDialog.price_credits || 1) && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium">Not enough credits! You need {(buyingDialog.price_credits || 1) - credits} more.</p>
                </div>
              )}

              <div className="text-sm text-gray-500">
                <p>After purchase you will have access to:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Full text content of the sample</li>
                  <li>Downloadable file (if attached)</li>
                  <li>Permanent access from your dashboard</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyingDialog(null)}>Cancel</Button>
            <Button 
              onClick={() => handlePurchaseSample(buyingDialog)}
              disabled={buying || credits < (buyingDialog?.price_credits || 1)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              {buying ? 'Purchasing...' : 'Confirm Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Purchased Sample Dialog */}
      <Dialog open={!!viewingSample} onOpenChange={(open) => !open && setViewingSample(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Sample Purchased!
            </DialogTitle>
          </DialogHeader>
          
          {viewingSample && (
            <div className="space-y-4 py-4">
              <h4 className="font-bold text-lg">{viewingSample.title}</h4>
              <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingSample.content}</p>
              </div>
              {viewingSample.pdf_url && (
                <button
                  type="button"
                  onClick={() => downloadSampleFile(viewingSample.pdf_url, viewingSample.pdf_filename).catch(() => toast.error('Download failed'))}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  <FileText className="w-5 h-5" />
                  Download Full File
                </button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewingSample(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DiscoverWriters;