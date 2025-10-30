import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star, Sparkles, Send } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReviewPage = () => {
  const { businessId } = useParams();
  const [business, setBusiness] = useState(null);
  const [keywords, setKeywords] = useState("");
  const [generatedReview, setGeneratedReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("English");
  const [sentiment, setSentiment] = useState("Positive");

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await axios.get(`${API}/business/${businessId}`);
      setBusiness(response.data);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 404) {
        toast.error("Business not found. Please check the link and try again.");
      } else {
        toast.error("Unable to load business details. Please try again later.");
      }
    }
  };

  const handleGenerateReview = async () => {
    if (!keywords.trim()) {
      toast.error("Please enter some keywords about your experience");
      return;
    }

    if (keywords.trim().split(/\s+/).length < 3) {
      toast.error("Please add at least 3 keywords for a better review");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/review/generate`, {
        rating: 5, // Default to 5 stars since rating removed from UI
        keywords,
        business_name: business.name,
        language,
        sentiment
      });
      
      if (!response.data.generated_review) {
        throw new Error("No review generated");
      }
      
      setGeneratedReview(response.data.generated_review);
      toast.success("Review generated successfully!");
    } catch (error) {
      console.error(error);
      if (error.response?.status === 500) {
        toast.error("AI service unavailable. Please try again in a moment.");
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error("Failed to generate review. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndRedirect = () => {
    // Copy review to clipboard
    navigator.clipboard.writeText(generatedReview).then(() => {
      toast.success("Review copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy review. Please copy manually.");
    });
    
    // Detect if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Build Google review URL - mobile-friendly format
    let googleReviewUrl;
    if (isMobile) {
      // Mobile-optimized Google review URL
      googleReviewUrl = `https://search.google.com/local/writereview?placeid=${business.google_place_id}`;
    } else {
      // Desktop Google review URL
      googleReviewUrl = `https://search.google.com/local/writereview?placeid=${business.google_place_id}`;
    }
    
    // Open in new tab/window
    const newWindow = window.open(googleReviewUrl, '_blank');
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Popup was blocked
      toast.error("Popup blocked! Please allow popups and try again.");
    } else {
      toast.success("Opening Google review page...", { duration: 2000 });
    }
    
    // Close the modal
    setTimeout(() => {
      setGeneratedReview("");
    }, 1000);
  };

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Star className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
            Revio
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Smart. Fast. Reliable reviews.
          </p>
          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-sm font-medium text-gray-700">
              Review for: <span className="text-blue-600 font-semibold">{business.name}</span>
            </p>
          </div>
        </div>

        {/* Review Form */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">Leave Your Review</CardTitle>
            <CardDescription>
              Select language, tone, and add keywords to generate your review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Selection */}
            <div className="space-y-3">
              <Label htmlFor="language" className="text-base font-medium">
                Review Language
              </Label>
              <select
                id="language"
                data-testid="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="English">English</option>
                <option value="Hindi">हिंदी (Hindi)</option>
                <option value="Spanish">Español (Spanish)</option>
                <option value="French">Français (French)</option>
                <option value="German">Deutsch (German)</option>
                <option value="Arabic">العربية (Arabic)</option>
                <option value="Chinese">中文 (Chinese)</option>
                <option value="Japanese">日本語 (Japanese)</option>
                <option value="Portuguese">Português (Portuguese)</option>
                <option value="Russian">Русский (Russian)</option>
              </select>
            </div>

            {/* Sentiment Selection */}
            <div className="space-y-3">
              <Label htmlFor="sentiment" className="text-base font-medium">
                Review Tone
              </Label>
              <select
                id="sentiment"
                data-testid="sentiment-select"
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Positive">Positive (Recommend)</option>
                <option value="Neutral">Neutral (Balanced)</option>
                <option value="Negative">Negative (Critical)</option>
              </select>
              <p className="text-xs text-gray-500">
                Choose the overall tone of your review
              </p>
            </div>

            {/* Keywords Input */}
            <div className="space-y-3">
              <Label htmlFor="keywords" className="text-base font-medium">
                Keywords
              </Label>
              <Textarea
                id="keywords"
                data-testid="keywords-input"
                placeholder="e.g., cafe latte 100rs good nice, friendly staff, cozy atmosphere"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Add keywords about your experience - AI will create an authentic review
              </p>
            </div>

            {/* Generate Button */}
            <Button
              data-testid="generate-review-button"
              onClick={handleGenerateReview}
              disabled={loading || !keywords.trim()}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? "Generating..." : "Generate Review"}
            </Button>
          </CardContent>
        </Card>

        {/* Review Popup Modal */}
        {generatedReview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="max-w-lg w-full border-0 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Your Generated Review</CardTitle>
                <CardDescription>
                  Review the text below and submit to Google
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    "{generatedReview}"
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    data-testid="submit-to-google-button"
                    onClick={handleCopyAndRedirect}
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit to Google
                  </Button>
                  <Button
                    data-testid="cancel-button"
                    onClick={() => setGeneratedReview("")}
                    variant="outline"
                    className="h-12 px-6"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-medium mb-1">
                    📋 How it works:
                  </p>
                  <p className="text-xs text-blue-800">
                    • Your review will be copied automatically<br/>
                    • Google's review page will open<br/>
                    • Paste your review and submit on Google
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPage;
