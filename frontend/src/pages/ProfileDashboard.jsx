import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Building2, CreditCard, Calendar, CheckCircle2, AlertCircle, Mail, Phone, LifeBuoy,
  Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, TrendingDown, Minus, RefreshCw, LogOut, Edit
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfileDashboard = () => {
  const [business, setBusiness] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketData, setTicketData] = useState({
    subject: "",
    description: "",
    priority: "medium"
  });
  
  // Google Business data
  const [googleVerifying, setGoogleVerifying] = useState(false);
  const [googleReviews, setGoogleReviews] = useState([]);
  const [googleKeywords, setGoogleKeywords] = useState({ positive: [], negative: [] });
  const [googleMetrics, setGoogleMetrics] = useState(null);
  const [googleInsights, setGoogleInsights] = useState(null);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Reply dialog
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [suggestedReply, setSuggestedReply] = useState('');
  const [replyText, setReplyText] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  
  // Logout confirmation
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  // Edit business dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    email: '',
    phone: '',
    address: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  
  const navigate = useNavigate();

  // Get business ID from URL or localStorage
  const businessId = new URLSearchParams(window.location.search).get('id') || localStorage.getItem('business_id');

  useEffect(() => {
    if (businessId) {
      fetchBusinessData();
      fetchSubscriptionStatus();
      fetchPaymentHistory();
    } else {
      navigate('/');
    }
  }, [businessId]);

  useEffect(() => {
    // Load Google data if business is verified
    if (business?.google_verified && business?.google_location_name) {
      loadGoogleData();
    }
  }, [business]);

  // Auto-apply filters when they change
  useEffect(() => {
    if (business?.google_verified && business?.google_location_name) {
      loadGoogleReviews();
    }
  }, [ratingFilter, searchKeyword, sortBy]);

  const fetchBusinessData = async () => {
    try {
      const response = await axios.get(`${API}/business/${businessId}`);
      setBusiness(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load business data");
    }
  };

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscription/status/${businessId}`);
      setSubscription(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await axios.get(`${API}/subscription/payment-history/${businessId}`);
      setPayments(response.data.payments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleBuySubscription = () => {
    navigate(`/subscribe?business_id=${businessId}`);
  };


  // Google Business functions
  const initiateGoogleVerification = async () => {
    try {
      setGoogleVerifying(true);
      const response = await fetch(`${API}/auth/google/initiate?business_id=${businessId}`);
      const data = await response.json();

      // Open popup for OAuth
      const popup = window.open(
        data.authorization_url,
        'Google Authorization',
        'width=600,height=700'
      );

      // Listen for messages from popup
      const handleMessage = async (event) => {
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          toast.success('Google verification successful!');
          // Reload business data and Google data
          await fetchBusinessData();
          setTimeout(() => loadGoogleData(), 1000);
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          toast.error(`Verification failed: ${event.data.error}`);
        }
        setGoogleVerifying(false);
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      toast.error('Failed to initiate Google authorization');
      setGoogleVerifying(false);
    }
  };

  const loadGoogleData = async () => {
    try {
      // Load all Google data
      await Promise.all([
        loadGoogleReviews(),
        loadGoogleKeywords(),
        loadGoogleMetrics()
      ]);
    } catch (error) {
      console.error('Error loading Google data:', error);
    }
  };

  const loadGoogleReviews = async () => {
    try {
      const params = new URLSearchParams();
      if (ratingFilter !== 'all') params.append('rating_filter', ratingFilter);
      if (searchKeyword) params.append('keyword', searchKeyword);
      params.append('sort_by', sortBy);
      
      const response = await fetch(
        `${API}/google/reviews-filtered/${businessId}?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGoogleReviews(data.reviews);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
    
    // Fallback to dummy data with client-side filtering
    let reviews = getDummyReviews();
    
    // Apply rating filter
    if (ratingFilter !== 'all') {
      const rating = parseInt(ratingFilter);
      reviews = reviews.filter(r => r.rating === rating);
    }
    
    // Apply keyword search
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      reviews = reviews.filter(r => 
        r.comment.toLowerCase().includes(keyword) ||
        r.reviewer_name.toLowerCase().includes(keyword)
      );
    }
    
    // Apply sorting
    if (sortBy === 'newest') {
      reviews.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
    } else if (sortBy === 'oldest') {
      reviews.sort((a, b) => new Date(a.create_time) - new Date(b.create_time));
    } else if (sortBy === 'highest') {
      reviews.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'lowest') {
      reviews.sort((a, b) => a.rating - b.rating);
    }
    
    setGoogleReviews(reviews);
  };

  const loadGoogleKeywords = async () => {
    try {
      const response = await fetch(`${API}/google/keywords/${businessId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGoogleKeywords(data.keywords);
          setGoogleInsights(data.insights);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading keywords:', error);
    }
    // Fallback to dummy data
    setGoogleKeywords({
      positive: [
        { word: 'excellent', count: 28 },
        { word: 'friendly', count: 24 },
        { word: 'delicious', count: 22 }
      ],
      negative: [
        { word: 'slow', count: 8 },
        { word: 'expensive', count: 6 }
      ]
    });
    setGoogleInsights({
      total_reviews: 85,
      positive_reviews: 68,
      negative_reviews: 9,
      positive_percentage: 80,
      negative_percentage: 10.6
    });
  };

  const loadGoogleMetrics = async () => {
    try {
      const response = await fetch(`${API}/google/metrics/${businessId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGoogleMetrics(data.metrics);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
    // Fallback to dummy data
    setGoogleMetrics({
      average_rating: 4.6,
      total_reviews: 85,
      recent_count: 12,
      trend: 0.3,
      trend_direction: 'up'
    });
  };

  const getDummyReviews = () => {
    return [
      {
        review_id: '1',
        reviewer_name: 'Sarah Johnson',
        rating: 5,
        comment: 'Amazing coffee shop! The baristas are super friendly and the atmosphere is perfect for working.',
        create_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Thank you so much for the kind words, Sarah!'
      },
      {
        review_id: '2',
        reviewer_name: 'Michael Chen',
        rating: 4,
        comment: 'Great place for a quick coffee. Service is usually fast, though it can get crowded during lunch hours.',
        create_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Thanks for your feedback, Michael!'
      },
      {
        review_id: '3',
        reviewer_name: 'Emily Rodriguez',
        rating: 5,
        comment: 'This is my favorite coffee spot in the area! The staff remembers my order and always greets me with a smile.',
        create_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false
      },
      {
        review_id: '4',
        reviewer_name: 'David Thompson',
        rating: 2,
        comment: 'Waited 20 minutes for my coffee during the morning rush. The drink was good but the wait time was frustrating.',
        create_time: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'We sincerely apologize for the long wait, David.'
      },
      {
        review_id: '5',
        reviewer_name: 'Lisa Park',
        rating: 5,
        comment: 'Absolutely love this place! Best cold brew in town. The outdoor seating is lovely and the vibe is very relaxed.',
        create_time: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false
      }
    ];
  };

  const handleReplyClick = (review) => {
    setSelectedReview(review);
    setSuggestedReply('');
    setReplyText('');
    setShowReplyDialog(true);
  };

  const generateAIReply = async () => {
    try {
      setGeneratingReply(true);
      const response = await axios.post(`${API}/google/generate-reply`, {
        reviewer_name: selectedReview.reviewer_name,
        rating: selectedReview.rating,
        comment: selectedReview.comment,
        business_name: business?.name || 'our business'
      });
      
      if (response.data.success) {
        const reply = response.data.suggested_reply;
        setSuggestedReply(reply);
        setReplyText(reply);
        toast.success('AI reply generated! You can edit it before sending.');
      }
    } catch (error) {
      console.error('Error generating reply:', error);
      toast.error('Failed to generate reply. Please try again.');
    } finally {
      setGeneratingReply(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }
    
    try {
      setSendingReply(true);
      const response = await axios.post(
        `${API}/google/post-reply/${businessId}/${selectedReview.review_id}`,
        { reply_text: replyText }
      );
      
      if (response.data.success) {
        if (response.data.demo_mode) {
          toast.success('Reply saved! Please verify your Google Business Profile to post live replies.');
        } else if (response.data.warning) {
          toast.warning(response.data.message);
        } else {
          toast.success('Reply sent successfully to Google!');
        }
        setShowReplyDialog(false);
        // Reload reviews
        await loadGoogleReviews();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to send reply. Please try again.';
      toast.error(errorMsg);
    } finally {
      setSendingReply(false);
    }
  };


  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tickets/create`, {
        business_id: businessId,
        ...ticketData
      });
      toast.success("Support ticket created! We'll get back to you soon.");
      setShowTicketDialog(false);
      setTicketData({ subject: "", description: "", priority: "medium" });
    } catch (error) {
      console.error(error);
      toast.error("Failed to create ticket");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { color: "bg-green-100 text-green-800", icon: CheckCircle2, text: "Active" },
      expired: { color: "bg-red-100 text-red-800", icon: AlertCircle, text: "Expired" },
      trial: { color: "bg-blue-100 text-blue-800", icon: Calendar, text: "Trial" },
      none: { color: "bg-gray-100 text-gray-800", icon: AlertCircle, text: "No Subscription" }
    };
    
    const badge = badges[status] || badges.none;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.text}
      </span>
    );
  };

  const handleLogout = () => {
    // Clear all business-related data from localStorage
    localStorage.removeItem('business_id');
    localStorage.removeItem('business_email');
    
    // Show success message
    toast.success("Logged out successfully");
    
    // Navigate to home/login page
    navigate('/');
  };

  const handleEditClick = () => {
    if (business) {
      setEditForm({
        name: business.name || '',
        category: business.category || '',
        email: business.email || business.owner_email || '',
        phone: business.phone || '',
        address: business.address || ''
      });
      setShowEditDialog(true);
    }
  };

  const handleEditSave = async () => {
    try {
      setSavingEdit(true);
      
      const response = await axios.put(
        `${API}/business/${businessId}`,
        editForm
      );
      
      if (response.data) {
        toast.success("Business information updated successfully!");
        setShowEditDialog(false);
        // Refresh business data
        fetchBusinessData();
      }
    } catch (error) {
      console.error("Error updating business:", error);
      toast.error(error.response?.data?.detail || "Failed to update business information");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Business Dashboard
            </h1>
            <p className="text-gray-600">
              Manage your subscription and view your business details
            </p>
          </div>
          <Button
            onClick={() => setShowLogoutDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Business Info & Subscription */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Information */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <CardTitle>Business Information</CardTitle>
                  </div>
                  {business && (
                    <Button
                      onClick={handleEditClick}
                      variant="outline"
                      size="sm"
                      data-testid="edit-business-btn"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {business ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Business Name</p>
                      <p className="text-base text-gray-900">{business.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Category</p>
                      <p className="text-base text-gray-900">{business.category || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-base text-gray-900">{business.email || business.owner_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-base text-gray-900">{business.phone || "Not provided"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-base text-gray-900">{business.address || "Not provided"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Loading business information...</p>
                )}
              </CardContent>
            </Card>

            {/* Subscription Status */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                  </div>
                  <CardTitle>Subscription Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription && subscription.has_subscription ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status</span>
                      {getStatusBadge(subscription.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Plan Type</p>
                        <p className="text-base text-gray-900 capitalize">{subscription.plan_type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Amount</p>
                        <p className="text-base text-gray-900">
                          {subscription.currency === 'CAD' ? '$' : '₹'}{subscription.amount}
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-blue-900">Expires On</p>
                        <p className="text-sm font-semibold text-blue-900">
                          {new Date(subscription.expiry_date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-xs text-blue-700">
                        {subscription.days_remaining} days remaining
                      </p>
                    </div>

                    {subscription.days_remaining < 7 && subscription.is_active && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Your subscription is expiring soon. Renew now to avoid service interruption.
                        </p>
                      </div>
                    )}

                    {!subscription.is_active && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800">
                          ❌ Your subscription has expired. Purchase a new plan to regain access.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleBuySubscription}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      {subscription.is_active ? "Renew Subscription" : "Buy Subscription"}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No active subscription</p>
                    <Button
                      onClick={handleBuySubscription}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      Get Started - Buy Subscription
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            {payments.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>Your recent payment transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {payment.currency === 'CAD' ? '$' : '₹'}{payment.amount}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(payment.completed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-green-600">Completed</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Support & Quick Actions */}
          <div className="space-y-6">
            {/* Support Contact */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LifeBuoy className="w-5 h-5" />
                  Support
                </CardTitle>
                <CardDescription>Need help? We're here for you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setShowTicketDialog(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  data-testid="create-ticket-btn"
                >
                  <LifeBuoy className="w-4 h-4 mr-2" />
                  Create Support Ticket
                </Button>
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Email</p>
                      <a
                        href="mailto:contact.revio@gmail.com"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        contact.revio@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Payments</span>
                  <span className="text-sm font-semibold text-gray-900">{payments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Account Status</span>
                  <span className="text-sm font-semibold text-green-600">
                    {subscription?.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

        {/* Google Business Reviews & Insights Section */}
        {business && (
          <div className="mt-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Google Business Insights</CardTitle>
                    <CardDescription>Monitor your Google reviews and ratings</CardDescription>
                  </div>
                  {!business.google_verified || !business.google_location_name ? (
                    <Button 
                      onClick={initiateGoogleVerification}
                      disabled={googleVerifying}
                      data-testid="verify-google-btn"
                    >
                      {googleVerifying ? 'Verifying...' : 'Connect Google Business'}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={loadGoogleData}
                      data-testid="refresh-google-btn"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              {business.google_verified && business.google_location_name ? (
                <CardContent className="space-y-6">
                  {/* Metrics Cards */}
                  {googleMetrics && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Average Rating</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {googleMetrics.average_rating?.toFixed(1) || '0.0'}
                              </p>
                              <div className="flex mt-1">
                                {renderStars(Math.round(googleMetrics.average_rating || 0))}
                              </div>
                            </div>
                            <Star className="w-8 h-8 text-amber-500 fill-amber-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Total Reviews</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {googleMetrics.total_reviews || 0}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {googleMetrics.recent_count || 0} this month
                              </p>
                            </div>
                            <MessageSquare className="w-8 h-8 text-blue-600" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Rating Trend</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {googleMetrics.trend >= 0 ? '+' : ''}{googleMetrics.trend?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">vs last month</p>
                            </div>
                            {googleMetrics.trend_direction === 'up' ? (
                              <TrendingUp className="w-8 h-8 text-green-600" />
                            ) : googleMetrics.trend_direction === 'down' ? (
                              <TrendingDown className="w-8 h-8 text-red-600" />
                            ) : (
                              <Minus className="w-8 h-8 text-gray-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Sentiment</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {googleInsights?.positive_percentage?.toFixed(0) || 0}%
                              </p>
                              <p className="text-xs text-gray-500 mt-1">Positive</p>
                            </div>
                            <ThumbsUp className="w-8 h-8 text-purple-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ThumbsUp className="w-5 h-5 text-green-600" />
                          Top Positive Words
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {googleKeywords.positive.slice(0, 6).map((kw, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800">
                              {kw.word} ({kw.count})
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ThumbsDown className="w-5 h-5 text-red-600" />
                          Top Negative Words
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {googleKeywords.negative.slice(0, 6).map((kw, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-red-100 text-red-800">
                              {kw.word} ({kw.count})
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Reviews Section with Filters */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-4">Customer Reviews</h3>
                      
                      {/* Filters */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        <Input
                          placeholder="Search reviews..."
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          className="max-w-xs"
                          data-testid="search-reviews-input"
                        />
                        
                        <Select value={ratingFilter} onValueChange={setRatingFilter}>
                          <SelectTrigger className="w-[140px]" data-testid="rating-filter-select">
                            <SelectValue placeholder="All Ratings" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Ratings</SelectItem>
                            <SelectItem value="5">5 Stars</SelectItem>
                            <SelectItem value="4">4 Stars</SelectItem>
                            <SelectItem value="3">3 Stars</SelectItem>
                            <SelectItem value="2">2 Stars</SelectItem>
                            <SelectItem value="1">1 Star</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-[140px]" data-testid="sort-select">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="highest">Highest Rated</SelectItem>
                            <SelectItem value="lowest">Lowest Rated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Reviews List with Scroll */}
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2" data-testid="reviews-list">
                      {googleReviews.length > 0 ? (
                        googleReviews.map((review, index) => (
                          <Card key={review.review_id || index} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                    {review.reviewer_name?.[0]?.toUpperCase() || 'A'}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{review.reviewer_name}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(review.create_time).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex">
                                    {renderStars(review.rating)}
                                  </div>
                                  {review.has_reply && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Replied
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                                {review.comment}
                              </p>

                              {review.reply_comment ? (
                                <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                                  <p className="text-xs font-semibold text-blue-900 mb-1">Your Response</p>
                                  <p className="text-sm text-blue-800">{review.reply_comment}</p>
                                </div>
                              ) : (
                                <div className="mt-3">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleReplyClick(review)}
                                    data-testid={`reply-btn-${index}`}
                                  >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Reply
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <Card className="bg-gray-50">
                          <CardContent className="p-8 text-center">
                            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No reviews yet</p>
                            <p className="text-sm text-gray-500 mt-1">Reviews will appear here once customers start leaving feedback</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Star className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Connect Your Google Business Profile
                      </h3>
                      <p className="text-gray-600 max-w-md mx-auto">
                        Link your Google Business account to monitor reviews, track ratings, and respond to customer feedback directly from your dashboard.
                      </p>
                    </div>
                    <Button 
                      onClick={initiateGoogleVerification}
                      disabled={googleVerifying}
                      size="lg"
                      className="mt-4"
                    >
                      {googleVerifying ? 'Connecting...' : 'Connect Google Business'}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}


      {/* Support Ticket Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription>
              Describe your issue and we'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={ticketData.subject}
                onChange={(e) => setTicketData({...ticketData, subject: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={ticketData.priority} 
                onValueChange={(value) => setTicketData({...ticketData, priority: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Please provide detailed information about your issue..."
                value={ticketData.description}
                onChange={(e) => setTicketData({...ticketData, description: e.target.value})}
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowTicketDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Reply to Review
            </DialogTitle>
            <DialogDescription>
              {selectedReview && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{selectedReview.reviewer_name}</span>
                    <div className="flex">
                      {renderStars(selectedReview.rating)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{selectedReview.comment}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={generateAIReply}
                disabled={generatingReply}
                variant="outline"
                size="sm"
                data-testid="generate-ai-reply"
              >
                {generatingReply ? 'Generating...' : 'Generate AI Reply'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reply-text">Your Reply</Label>
              <Textarea
                id="reply-text"
                placeholder="Write your response to this review..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                data-testid="reply-textarea"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReplyDialog(false)}
              data-testid="cancel-reply"
            >
              Cancel
            </Button>
            <Button 
              onClick={sendReply}
              disabled={sendingReply || !replyText.trim()}
              data-testid="send-reply"
            >
              {sendingReply ? 'Sending...' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Reply to Review
            </DialogTitle>
            <DialogDescription>
              {selectedReview && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{selectedReview.reviewer_name}</span>
                    <div className="flex">
                      {renderStars(selectedReview.rating)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{selectedReview.comment}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={generateAIReply}
                disabled={generatingReply}
                variant="outline"
                size="sm"
                data-testid="generate-ai-reply"
              >
                {generatingReply ? 'Generating...' : 'Generate AI Reply'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reply-text">Your Reply</Label>
              <Textarea
                id="reply-text"
                placeholder="Write your response to this review..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                data-testid="reply-textarea"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReplyDialog(false)}
              data-testid="cancel-reply"
            >
              Cancel
            </Button>
            <Button 
              onClick={sendReply}
              disabled={sendingReply || !replyText.trim()}
              data-testid="send-reply"
            >
              {sendingReply ? 'Sending...' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Business Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Business Information</DialogTitle>
            <DialogDescription>
              Update your business details below
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Business Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Enter business name"
                data-testid="edit-business-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={editForm.category}
                onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                placeholder="e.g., Restaurant, Cafe, Retail"
                data-testid="edit-business-category"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                placeholder="business@example.com"
                data-testid="edit-business-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                placeholder="+1234567890"
                data-testid="edit-business-phone"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                placeholder="Enter full business address"
                rows={3}
                data-testid="edit-business-address"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditSave}
              disabled={savingEdit || !editForm.name || !editForm.email}
              data-testid="save-edit"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You'll need to login again to access your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-logout">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-logout"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileDashboard;
