import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const GoogleVerification = () => {
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [reviewsData, setReviewsData] = useState(null);
  const [step, setStep] = useState('init'); // init, accounts, locations, reviews

  const businessId = localStorage.getItem('businessId') || 
                     localStorage.getItem('business_id') ||
                     new URLSearchParams(window.location.search).get('id');
  const businessEmail = localStorage.getItem('businessEmail') || 
                        localStorage.getItem('business_email');
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (!businessId) {
      navigate('/');
      return;
    }
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/business/${businessId}`);
      const data = await response.json();
      setBusiness(data);

      if (data.google_verified) {
        // Load accounts if already verified
        await loadAccounts();
        if (data.google_account_name) {
          setSelectedAccount(data.google_account_name);
          await loadLocations();
          if (data.google_location_name) {
            setSelectedLocation(data.google_location_name);
            setStep('reviews');
            await loadReviews();
          } else {
            setStep('locations');
          }
        } else {
          setStep('accounts');
        }
      } else {
        setStep('init');
      }
    } catch (error) {
      console.error('Error loading business:', error);
      toast.error('Failed to load business data');
    } finally {
      setLoading(false);
    }
  };

  const initiateGoogleAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/google/initiate?business_id=${businessId}`);
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
          await loadBusinessData();
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          toast.error(`Verification failed: ${event.data.error}`);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      toast.error('Failed to initiate Google authorization');
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/accounts/${businessId}`);
      const data = await response.json();
      if (data.success) {
        setAccounts(data.accounts);
        if (data.selected_account) {
          setSelectedAccount(data.selected_account);
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Failed to load Google Business accounts');
    }
  };

  const selectAccount = async (accountName) => {
    try {
      const response = await fetch(
        `${API_URL}/api/google/select-account/${businessId}?account_name=${encodeURIComponent(accountName)}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        setSelectedAccount(accountName);
        toast.success('Account selected successfully');
        setStep('locations');
        await loadLocations();
      }
    } catch (error) {
      console.error('Error selecting account:', error);
      toast.error('Failed to select account');
    }
  };

  const loadLocations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/locations/${businessId}`);
      const data = await response.json();
      if (data.success) {
        setLocations(data.locations);
        if (data.selected_location) {
          setSelectedLocation(data.selected_location);
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load business locations');
    }
  };

  const selectLocation = async (locationName) => {
    try {
      const response = await fetch(
        `${API_URL}/api/google/select-location/${businessId}?location_name=${encodeURIComponent(locationName)}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        setSelectedLocation(locationName);
        toast.success('Location selected successfully! Redirecting to dashboard...');
        // Redirect to Google Business Dashboard
        setTimeout(() => {
          navigate(`/google-dashboard?id=${businessId}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Error selecting location:', error);
      toast.error('Failed to select location');
    }
  };

  const loadReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/reviews/${businessId}`);
      const data = await response.json();
      if (data.success) {
        setReviewsData(data.data);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load reviews');
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= rating ? 'star filled' : 'star'}>★</span>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="verification-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="verification-container" data-testid="google-verification-page">
      <div className="verification-card">
        <button 
          className="back-btn" 
          onClick={() => navigate('/dashboard')}
          data-testid="back-to-dashboard-btn"
        >
          ← Back to Dashboard
        </button>

        <h1>Google Business Verification</h1>
        
        {step === 'init' && (
          <div className="init-step" data-testid="init-step">
            <p className="description">
              Connect your Google Business Profile to fetch and display your reviews, ratings, and business insights.
            </p>
            <button 
              className="verify-btn" 
              onClick={initiateGoogleAuth}
              data-testid="verify-google-btn"
            >
              Verify with Google
            </button>
          </div>
        )}

        {step === 'accounts' && (
          <div className="accounts-step" data-testid="accounts-step">
            <h2>Select Your Business Account</h2>
            <div className="accounts-list">
              {accounts.map((account) => (
                <div 
                  key={account.name} 
                  className={`account-card ${selectedAccount === account.name ? 'selected' : ''}`}
                  onClick={() => selectAccount(account.name)}
                  data-testid={`account-${account.name}`}
                >
                  <h3>{account.accountName || 'Business Account'}</h3>
                  <p>{account.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'locations' && (
          <div className="locations-step" data-testid="locations-step">
            <h2>Select Your Business Location</h2>
            <div className="locations-list">
              {locations.map((location) => (
                <div 
                  key={location.name} 
                  className={`location-card ${selectedLocation === location.name ? 'selected' : ''}`}
                  onClick={() => selectLocation(location.name)}
                  data-testid={`location-${location.name}`}
                >
                  <h3>{location.title}</h3>
                  <p>{location.storefrontAddress?.addressLines?.join(', ')}</p>
                  <p>{location.phoneNumbers?.[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'reviews' && reviewsData && (
          <div className="reviews-step" data-testid="reviews-step">
            <div className="reviews-header">
              <h2>Your Google Reviews</h2>
              <button 
                className="refresh-btn" 
                onClick={loadReviews}
                data-testid="refresh-reviews-btn"
              >
                Refresh
              </button>
            </div>

            <div className="stats-container">
              <div className="stat-card" data-testid="average-rating">
                <h3>Average Rating</h3>
                <div className="stat-value">
                  {reviewsData.average_rating ? reviewsData.average_rating.toFixed(1) : '0.0'}
                  <span className="stars">{renderStars(Math.round(reviewsData.average_rating || 0))}</span>
                </div>
              </div>
              <div className="stat-card" data-testid="total-reviews">
                <h3>Total Reviews</h3>
                <div className="stat-value">{reviewsData.total_review_count || 0}</div>
              </div>
            </div>

            <div className="reviews-list">
              <h3>Recent Reviews</h3>
              {reviewsData.reviews && reviewsData.reviews.length > 0 ? (
                reviewsData.reviews.map((review, index) => (
                  <div key={index} className="review-card" data-testid={`review-${index}`}>
                    <div className="review-header">
                      <div className="reviewer-info">
                        <span className="reviewer-name">
                          {review.reviewer?.displayName || 'Anonymous'}
                        </span>
                        <span className="review-date">
                          {review.createTime ? new Date(review.createTime).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div className="rating">
                        {renderStars(review.starRating === 'FIVE' ? 5 : 
                                    review.starRating === 'FOUR' ? 4 : 
                                    review.starRating === 'THREE' ? 3 : 
                                    review.starRating === 'TWO' ? 2 : 1)}
                      </div>
                    </div>
                    <p className="review-comment">{review.comment || 'No comment'}</p>
                    {review.reviewReply && (
                      <div className="review-reply">
                        <strong>Your Reply:</strong>
                        <p>{review.reviewReply.comment}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="no-reviews">No reviews found</p>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .verification-container {
          min-height: 100vh;
          padding: 2rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
        }

        .verification-card {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .back-btn {
          background: none;
          border: none;
          color: #5b6ef5;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 1rem;
          padding: 0.5rem 0;
        }

        .back-btn:hover {
          text-decoration: underline;
        }

        h1 {
          font-size: 2rem;
          color: #1a1a2e;
          margin-bottom: 1rem;
        }

        h2 {
          font-size: 1.5rem;
          color: #1a1a2e;
          margin-bottom: 1.5rem;
        }

        .description {
          color: #666;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .verify-btn {
          background: linear-gradient(135deg, #5b6ef5 0%, #8b5cf6 100%);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .verify-btn:hover {
          transform: translateY(-2px);
        }

        .accounts-list, .locations-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .account-card, .location-card {
          padding: 1.5rem;
          border: 2px solid #e8ecf1;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .account-card:hover, .location-card:hover {
          border-color: #5b6ef5;
          transform: translateY(-2px);
        }

        .account-card.selected, .location-card.selected {
          border-color: #5b6ef5;
          background: #f0f2ff;
        }

        .account-card h3, .location-card h3 {
          font-size: 1.1rem;
          color: #1a1a2e;
          margin-bottom: 0.5rem;
        }

        .account-card p, .location-card p {
          color: #666;
          font-size: 0.9rem;
        }

        .reviews-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .refresh-btn {
          background: #5b6ef5;
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
        }

        .stat-card h3 {
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          opacity: 0.9;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
        }

        .stat-value .stars {
          display: block;
          font-size: 1.2rem;
          margin-top: 0.5rem;
        }

        .reviews-list h3 {
          font-size: 1.2rem;
          margin-bottom: 1rem;
        }

        .review-card {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 12px;
          margin-bottom: 1rem;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .reviewer-name {
          font-weight: 600;
          color: #1a1a2e;
          margin-right: 1rem;
        }

        .review-date {
          color: #999;
          font-size: 0.85rem;
        }

        .rating .star {
          color: #ffd700;
          font-size: 1.2rem;
        }

        .review-comment {
          color: #444;
          line-height: 1.6;
        }

        .review-reply {
          margin-top: 1rem;
          padding: 1rem;
          background: #e3f2fd;
          border-left: 3px solid #5b6ef5;
          border-radius: 4px;
        }

        .review-reply strong {
          color: #5b6ef5;
        }

        .no-reviews {
          text-align: center;
          color: #999;
          padding: 2rem;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          font-size: 1.2rem;
          color: #666;
        }

        .star.filled {
          color: #ffd700;
        }

        .star {
          color: #ddd;
        }
      `}</style>
    </div>
  );
};

export default GoogleVerification;
