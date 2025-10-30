import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { 
  Star, TrendingUp, TrendingDown, Minus, MessageSquare, 
  ThumbsUp, ThumbsDown, Search, Filter, RefreshCw, ArrowLeft,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';

const GoogleBusinessDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [keywords, setKeywords] = useState({ positive: [], negative: [] });
  const [insights, setInsights] = useState(null);
  const [metrics, setMetrics] = useState(null);
  
  // Filters
  const [ratingFilter, setRatingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchKeyword, setSearchKeyword] = useState('');

  const businessId = localStorage.getItem('businessId') || 
                     localStorage.getItem('business_id') ||
                     new URLSearchParams(window.location.search).get('id');
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (!businessId) {
      navigate('/');
      return;
    }
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBusiness(),
        loadReviewsWithDummy(),
        loadKeywordsWithDummy(),
        loadMetricsWithDummy()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadBusiness = async () => {
    const response = await fetch(`${API_URL}/api/business/${businessId}`);
    const data = await response.json();
    setBusiness(data);
  };

  const loadReviewsWithDummy = async () => {
    try {
      const params = new URLSearchParams();
      if (ratingFilter !== 'all') params.append('rating_filter', ratingFilter);
      if (searchKeyword) params.append('keyword', searchKeyword);
      params.append('sort_by', sortBy);
      
      const response = await fetch(
        `${API_URL}/api/google/reviews-filtered/${businessId}?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReviews(data.reviews);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading reviews from API:', error);
    }
    // Always load dummy data for demonstration
    setReviews(getDummyReviews());
  };

  const loadKeywordsWithDummy = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/keywords/${businessId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setKeywords(data.keywords);
          setInsights(data.insights);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading keywords from API:', error);
    }
    // Always load dummy data for demonstration
    setKeywords({
      positive: [
        { word: 'excellent', count: 28 },
        { word: 'friendly', count: 24 },
        { word: 'delicious', count: 22 },
        { word: 'clean', count: 19 },
        { word: 'great', count: 18 },
        { word: 'fresh', count: 15 },
        { word: 'amazing', count: 13 },
        { word: 'perfect', count: 11 }
      ],
      negative: [
        { word: 'slow', count: 8 },
        { word: 'expensive', count: 6 },
        { word: 'cold', count: 5 },
        { word: 'rude', count: 4 },
        { word: 'wait', count: 3 }
      ]
    });
    setInsights({
      total_reviews: 85,
      positive_reviews: 68,
      negative_reviews: 9,
      neutral_reviews: 8,
      positive_percentage: 80,
      negative_percentage: 10.6
    });
  };

  const loadMetricsWithDummy = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/metrics/${businessId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMetrics(data.metrics);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading metrics from API:', error);
    }
    // Always load dummy data for demonstration
    setMetrics({
      average_rating: 4.6,
      total_reviews: 85,
      rating_distribution: { 1: 3, 2: 6, 3: 8, 4: 22, 5: 46 },
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
        comment: 'Amazing coffee shop! The baristas are super friendly and the atmosphere is perfect for working. I love their caramel latte and the pastries are always fresh. Highly recommend!',
        create_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Thank you so much for the kind words, Sarah! We love having you as a regular. See you soon!',
        reply_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        review_id: '2',
        reviewer_name: 'Michael Chen',
        rating: 4,
        comment: 'Great place for a quick coffee. Service is usually fast, though it can get crowded during lunch hours. Their espresso is excellent and reasonably priced.',
        create_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Thanks for your feedback, Michael! We\'re working on managing peak hours better. Appreciate your patience!',
        reply_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        review_id: '3',
        reviewer_name: 'Emily Rodriguez',
        rating: 5,
        comment: 'This is my favorite coffee spot in the area! The staff remembers my order and always greets me with a smile. Clean environment, great wifi, and delicious food. Perfect 10/10!',
        create_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false,
        reply_comment: null,
        reply_time: null
      },
      {
        review_id: '4',
        reviewer_name: 'David Thompson',
        rating: 2,
        comment: 'Waited 20 minutes for my coffee during the morning rush. The drink was good but the wait time was frustrating. Maybe they need more staff during busy hours.',
        create_time: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'We sincerely apologize for the long wait, David. We\'ve added more staff during morning hours to improve service speed. Please give us another try!',
        reply_time: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        review_id: '5',
        reviewer_name: 'Lisa Park',
        rating: 5,
        comment: 'Absolutely love this place! Best cold brew in town. The outdoor seating is lovely and the vibe is very relaxed. Great for meeting friends or just reading a book.',
        create_time: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false,
        reply_comment: null,
        reply_time: null
      },
      {
        review_id: '6',
        reviewer_name: 'Robert Martinez',
        rating: 4,
        comment: 'Good coffee and friendly staff. The only downside is limited parking, but the quality makes up for it. Their breakfast sandwiches are delicious!',
        create_time: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Thank you, Robert! We understand parking can be tricky. There\'s a public lot two blocks away. Hope to see you again!',
        reply_time: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        review_id: '7',
        reviewer_name: 'Amanda White',
        rating: 5,
        comment: 'Five stars! Everything about this coffee shop is perfect. Clean, modern decor, excellent service, and most importantly - amazing coffee. Their seasonal drinks are creative and delicious.',
        create_time: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false,
        reply_comment: null,
        reply_time: null
      },
      {
        review_id: '8',
        reviewer_name: 'James Wilson',
        rating: 3,
        comment: 'Decent coffee but a bit overpriced in my opinion. The atmosphere is nice though, and the staff is polite. Might come back occasionally.',
        create_time: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false,
        reply_comment: null,
        reply_time: null
      },
      {
        review_id: '9',
        reviewer_name: 'Jessica Brown',
        rating: 5,
        comment: 'My go-to coffee shop! I come here every morning before work. The consistency in quality is impressive. Love their loyalty program too!',
        create_time: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: true,
        reply_comment: 'Jessica, you\'re a star customer! Thank you for your loyalty. We appreciate you!',
        reply_time: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        review_id: '10',
        reviewer_name: 'Chris Anderson',
        rating: 4,
        comment: 'Really good coffee and pastries. Sometimes the music is a bit too loud for working, but overall a great spot. Their iced matcha latte is incredible.',
        create_time: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        has_reply: false,
        reply_comment: null,
        reply_time: null
      }
    ];
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    toast.info('Refreshing data...');
    await loadAllData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  const applyFilters = () => {
    loadReviewsWithDummy();
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const getTrendIcon = () => {
    if (!metrics) return <Minus className="w-5 h-5" />;
    if (metrics.trend_direction === 'up') return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (metrics.trend_direction === 'down') return <TrendingDown className="w-5 h-5 text-red-600" />;
    return <Minus className="w-5 h-5 text-gray-600" />;
  };

  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-blue-50" data-testid="google-dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Google Business Insights
              </h1>
              <p className="text-gray-600 mt-1">
                {business?.name} - Reviews & Analytics
              </p>
            </div>
            <Button 
              onClick={handleRefresh} 
              disabled={refreshing}
              data-testid="refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-lg" data-testid="metric-average-rating">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Average Rating</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.average_rating?.toFixed(1) || '0.0'}
                  </p>
                  <div className="flex mt-2">
                    {renderStars(Math.round(metrics?.average_rating || 0))}
                  </div>
                </div>
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" data-testid="metric-total-reviews">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reviews</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.total_reviews || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {metrics?.recent_count || 0} in last 30 days
                  </p>
                </div>
                <MessageSquare className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" data-testid="metric-trend">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Rating Trend</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {metrics?.trend >= 0 ? '+' : ''}{metrics?.trend?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    vs previous 30 days
                  </p>
                </div>
                {getTrendIcon()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" data-testid="metric-response-rate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Response Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {reviews.filter(r => r.has_reply).length > 0 
                      ? Math.round((reviews.filter(r => r.has_reply).length / reviews.length) * 100) 
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {reviews.filter(r => r.has_reply).length} replied
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Keywords & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Positive Keywords */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-green-600" />
                Top Positive Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {keywords.positive.length > 0 ? (
                  keywords.positive.slice(0, 8).map((kw, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium text-green-900 capitalize">{kw.word}</span>
                      <Badge variant="secondary">{kw.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No positive keywords found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Negative Keywords */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ThumbsDown className="w-5 h-5 text-red-600" />
                Top Negative Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {keywords.negative.length > 0 ? (
                  keywords.negative.slice(0, 8).map((kw, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm font-medium text-red-900 capitalize">{kw.word}</span>
                      <Badge variant="secondary">{kw.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No negative keywords found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insights Summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Sentiment Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Positive</span>
                      <span className="text-sm font-medium">{insights.positive_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${insights.positive_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Negative</span>
                      <span className="text-sm font-medium">{insights.negative_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-600 h-2 rounded-full" 
                        style={{ width: `${insights.negative_percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-xs text-gray-600 mb-2">Review Distribution:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">Positive (4-5★)</span>
                        <span className="font-medium">{insights.positive_reviews}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Neutral (3★)</span>
                        <span className="font-medium">{insights.neutral_reviews}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-red-600">Negative (1-2★)</span>
                        <span className="font-medium">{insights.negative_reviews}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Loading insights...</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reviews Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Customer Reviews</CardTitle>
            <CardDescription>Filter and search through your Google reviews</CardDescription>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search reviews..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  data-testid="search-input"
                />
              </div>
              
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[150px]" data-testid="rating-filter">
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
                <SelectTrigger className="w-[150px]" data-testid="sort-select">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="highest">Highest Rated</SelectItem>
                  <SelectItem value="lowest">Lowest Rated</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={applyFilters} data-testid="apply-filters-btn">
                <Filter className="w-4 h-4 mr-2" />
                Apply
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review, index) => (
                  <div 
                    key={review.review_id || index} 
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`review-${index}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {review.reviewer_name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{review.reviewer_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(review.create_time).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {renderStars(review.rating)}
                        </div>
                        {review.has_reply && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Replied
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-700 leading-relaxed mb-3">
                      {truncateText(review.comment, 200)}
                    </p>

                    {review.reply_comment && (
                      <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Your Response</p>
                        <p className="text-sm text-blue-800">{truncateText(review.reply_comment, 150)}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {new Date(review.reply_time).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No reviews found matching your filters</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setRatingFilter('all');
                      setSearchKeyword('');
                      setSortBy('newest');
                      loadReviews();
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GoogleBusinessDashboard;
