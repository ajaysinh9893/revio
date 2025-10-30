import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, QrCode, Star, Sparkles, CheckCircle2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HomePage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    google_place_id: "",
    owner_email: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/business/register`, formData);
      
      // Store business ID
      localStorage.setItem('business_id', response.data.id);
      
      toast.success("Business registered! Redirecting to payment...");
      
      // Redirect to payment page immediately
      setTimeout(() => {
        window.location.href = `/subscribe?business_id=${response.data.id}`;
      }, 1500);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to register business");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Star className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">
            Revio
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Smart. Fast. Reliable reviews.
          </p>
        </div>

        {/* Registration Form */}
          <div className="max-w-2xl mx-auto">
            {/* Google Business Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    Don't have a Google Business Profile yet?
                  </h3>
                  <p className="text-sm text-blue-800 mb-2">
                    You need to register your business on Google first to get a Place ID.
                  </p>
                  <div className="space-y-1">
                    <a
                      href="https://business.google.com/create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-800 underline"
                    >
                      Register on Google Business Profile →
                    </a>
                    <p className="text-xs text-blue-700">
                      Or search "Google Business Profile" in your browser
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-2xl">Register Your Business</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Create your unique QR code for customers to leave reviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Business Name *
                    </Label>
                    <Input
                      id="name"
                      data-testid="business-name-input"
                      placeholder="e.g., Joe's Coffee Shop"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium">
                      Business Category *
                    </Label>
                    <select
                      id="category"
                      data-testid="business-category-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      className="w-full h-12 px-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Cafe">Cafe</option>
                      <option value="Retail">Retail Store</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Salon">Salon/Spa</option>
                      <option value="Gym">Gym/Fitness</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Services">Services</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Business Email *
                      </Label>
                      <Input
                        id="email"
                        data-testid="business-email-input"
                        type="email"
                        placeholder="contact@business.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone Number *
                      </Label>
                      <Input
                        id="phone"
                        data-testid="business-phone-input"
                        type="tel"
                        placeholder="514-625-9893"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Business Address *
                    </Label>
                    <Input
                      id="address"
                      data-testid="business-address-input"
                      placeholder="123 Main St, City, Country"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="google_place_id" className="text-sm font-medium">
                      Google Place ID *
                    </Label>
                    <Input
                      id="google_place_id"
                      data-testid="google-place-id-input"
                      placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                      value={formData.google_place_id}
                      onChange={(e) => setFormData({ ...formData, google_place_id: e.target.value })}
                      required
                      className="h-12"
                    />
                    <p className="text-xs text-gray-500">
                      Find your Place ID at{" "}
                      <a
                        href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Google Place ID Finder
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner_email" className="text-sm font-medium">
                      Owner Email *
                    </Label>
                    <Input
                      id="owner_email"
                      data-testid="owner-email-input"
                      type="email"
                      placeholder="owner@business.com"
                      value={formData.owner_email}
                      onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                      required
                      className="h-12"
                    />
                  </div>

                  <Button
                    data-testid="register-button"
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    {loading ? "Registering..." : "Register & Subscribe"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white/60 backdrop-blur rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI-Powered</h3>
                <p className="text-sm text-gray-600">
                  Advanced AI transforms keywords into authentic reviews
                </p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                  <QrCode className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Easy QR Access</h3>
                <p className="text-sm text-gray-600">
                  Customers scan and submit reviews instantly
                </p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Under 10 Sec</h3>
                <p className="text-sm text-gray-600">
                  Complete review process in seconds
                </p>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default HomePage;
