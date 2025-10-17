import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, HelpCircle, Mail, MessageCircle, Book, Video, ExternalLink } from 'lucide-react';

function Help({ user }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (user?.user_type === 'creative') {
      navigate('/writer/dashboard');
    } else {
      navigate('/business/dashboard');
    }
  };

  const helpCategories = [
    {
      title: 'Getting Started',
      icon: Book,
      items: [
        { title: 'How to create your profile', link: '#' },
        { title: 'Understanding the platform', link: '#' },
        { title: 'Setting up your account', link: '#' },
      ]
    },
    {
      title: 'For Writers',
      icon: Book,
      items: [
        { title: 'Creating writing samples', link: '#' },
        { title: 'Finding projects', link: '#' },
        { title: 'Getting discovered by businesses', link: '#' },
      ]
    },
    {
      title: 'For Businesses',
      icon: Book,
      items: [
        { title: 'Posting projects', link: '#' },
        { title: 'Discovering writers', link: '#' },
        { title: 'Managing your credits', link: '#' },
      ]
    },
    {
      title: 'Video Tutorials',
      icon: Video,
      items: [
        { title: 'Platform walkthrough (5 min)', link: '#' },
        { title: 'Best practices for writers', link: '#' },
        { title: 'How to hire the right writer', link: '#' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Help & Support</h1>
          </div>
          
          <div className="w-32"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold">Email Support</h3>
              <p className="text-sm text-gray-600">Get help via email within 24 hours</p>
              <Button variant="outline" className="w-full">
                support@wordup.com
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold">Live Chat</h3>
              <p className="text-sm text-gray-600">Chat with us in real-time</p>
              <Button variant="outline" className="w-full">
                Start Chat
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Book className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold">Documentation</h3>
              <p className="text-sm text-gray-600">Browse our detailed guides</p>
              <Button variant="outline" className="w-full">
                View Docs
              </Button>
            </div>
          </Card>
        </div>

        {/* FAQ Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {helpCategories.map((category, idx) => (
            <Card key={idx} className="p-6 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <category.icon className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold">{category.title}</h2>
              </div>
              
              <ul className="space-y-3">
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <a 
                      href={item.link}
                      className="flex items-center justify-between text-gray-700 hover:text-green-600 transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* Common Questions */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-2">How do I update my profile?</h3>
              <p className="text-gray-600">
                Go to your dashboard and click on the Profile tab. From there, you can edit your information,
                add writing samples, and update your preferences.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and bank transfers. Credits can be purchased
                directly from your business dashboard.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">How does the matching system work?</h3>
              <p className="text-gray-600">
                Our algorithm matches writers with businesses based on genre preferences, experience level,
                and project requirements. Writers can be discovered through the swipe feature.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">Is my data secure?</h3>
              <p className="text-gray-600">
                Yes, we use industry-standard encryption and security practices to protect your data.
                Your information is never shared without your consent.
              </p>
            </div>
          </div>
        </Card>

        {/* Contact Form */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-4">Still Need Help?</h2>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Send us a message and we'll get back to you as soon as possible.
          </p>
          
          <Button className="bg-green-600 hover:bg-green-700">
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default Help;
