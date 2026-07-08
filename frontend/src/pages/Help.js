import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, HelpCircle, Mail, MessageCircle, Book, Video, ExternalLink, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

function Help({ user }) {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [sendingMessage, setSendingMessage] = useState(false);

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
              <Button variant="outline" className="w-full" onClick={() => {
                window.location.href = 'mailto:support@wordup.com';
              }}>
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
              <Button variant="outline" className="w-full" onClick={() => {
                toast.info('Live chat is coming soon! For now, please email us.');
              }}>
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
              <Button variant="outline" className="w-full" onClick={() => {
                toast.info('Documentation is being prepared. Check back soon!');
              }}>
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
                    <button
                      onClick={() => toast.info(`"${item.title}" guide coming soon`)}
                      className="flex items-center justify-between w-full text-left text-gray-700 hover:text-green-600 transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* Common Questions */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-2">
            {[
              {
                q: 'How do I update my profile?',
                a: 'Go to your dashboard and click on the Profile tab. From there, you can edit your information, add writing samples, and update your preferences.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and bank transfers. Credits can be purchased directly from your business dashboard.'
              },
              {
                q: 'How does the matching system work?',
                a: 'Our algorithm matches writers with businesses based on genre preferences, experience level, and project requirements. Writers can be discovered through the swipe feature.'
              },
              {
                q: 'Is my data secure?',
                a: 'Yes, we use industry-standard encryption and security practices to protect your data. Your information is never shared without your consent.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-bold">{faq.q}</h3>
                  {expandedFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === idx && (
                  <div className="px-4 pb-4">
                    <p className="text-gray-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Contact Form */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-4">Still Need Help?</h2>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Send us a message and we'll get back to you as soon as possible.
          </p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!contactForm.subject.trim() || !contactForm.message.trim()) {
              toast.error('Please fill in both fields');
              return;
            }
            setSendingMessage(true);
            // Simulate sending
            await new Promise(r => setTimeout(r, 1000));
            toast.success('Message sent! We\'ll get back to you within 24 hours.');
            setContactForm({ subject: '', message: '' });
            setSendingMessage(false);
          }} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="What do you need help with?"
                value={contactForm.subject}
                onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue or question in detail..."
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
                required
              />
            </div>
            <Button type="submit" disabled={sendingMessage} className="bg-green-600 hover:bg-green-700">
              <Send className="w-4 h-4 mr-2" />
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default Help;
