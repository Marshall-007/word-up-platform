import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Feather, Users, Sparkles, Globe, Award, TrendingUp } from 'lucide-react';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center fade-in">
            <div className="inline-flex items-center gap-3 mb-6">
              <Feather className="w-16 h-16 text-orange-600" />
              <h1 className="text-6xl lg:text-7xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Word Up
              </h1>
            </div>
            
            <h2 className="text-2xl lg:text-3xl text-gray-700 mb-6 max-w-3xl mx-auto">
              Where storytellers meet opportunities
            </h2>
            
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Connect African & global indigenous writers with production houses, agencies, and brands seeking authentic voices.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/auth')} 
                size="lg" 
                className="bg-orange-600 hover:bg-orange-700 text-lg px-8 py-6 rounded-full"
                data-testid="get-started-button"
              >
                Get Started
              </Button>
              <Button 
                onClick={() => navigate('/auth')} 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 rounded-full border-2 border-orange-600 text-orange-600 hover:bg-orange-50"
                data-testid="learn-more-button"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center mb-16" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Why Word Up?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl" style={{ animation: 'fadeIn 0.6s ease-out 0.1s backwards' }}>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-orange-600" />
              </div>
              <h4 className="text-xl font-bold mb-3">AI-Powered Tools</h4>
              <p className="text-gray-600">
                Grammar suggestions, tone adjustment, and rewriting assistance to polish your craft.
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl" style={{ animation: 'fadeIn 0.6s ease-out 0.2s backwards' }}>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-xl font-bold mb-3">Direct Connections</h4>
              <p className="text-gray-600">
                Businesses discover writers through an intuitive card-swiping interface.
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl" style={{ animation: 'fadeIn 0.6s ease-out 0.3s backwards' }}>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-yellow-600" />
              </div>
              <h4 className="text-xl font-bold mb-3">Indigenous Voices</h4>
              <p className="text-gray-600">
                Supporting African and global indigenous writers with translation tools and visibility.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="fade-in">
              <div className="text-5xl font-bold text-orange-600 mb-2">5min</div>
              <div className="text-gray-600">Time-to-Match</div>
            </div>
            <div className="fade-in">
              <div className="text-5xl font-bold text-orange-600 mb-2">80%</div>
              <div className="text-gray-600">User Satisfaction</div>
            </div>
            <div className="fade-in">
              <div className="text-5xl font-bold text-orange-600 mb-2">$5/mo</div>
              <div className="text-gray-600">Pro Subscription</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Ready to tell your story?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Join Word Up today and connect with opportunities that match your voice.
          </p>
          <Button 
            onClick={() => navigate('/auth')} 
            size="lg"
            className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-6 rounded-full"
            data-testid="cta-join-button"
          >
            Join Now - It's Free
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>© 2025 Word Up. Empowering storytellers worldwide.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;