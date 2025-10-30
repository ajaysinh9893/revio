import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, LogIn, UserPlus } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BusinessLogin = () => {
  const [formData, setFormData] = useState({
    email: "",
    businessId: ""
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if business exists
      const response = await axios.get(`${API}/business/${formData.businessId}`);
      const business = response.data;

      // Verify email matches
      if (business.owner_email !== formData.email && business.email !== formData.email) {
        toast.error("Email does not match business records");
        setLoading(false);
        return;
      }

      // Store business ID and redirect to dashboard
      localStorage.setItem('business_id', business.id);
      toast.success("Login successful!");
      navigate(`/dashboard?id=${business.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Business not found. Please check your Business ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Revio</h1>
          <p className="text-gray-600">Smart. Fast. Reliable reviews.</p>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <LogIn className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-2xl">Business Login</CardTitle>
            </div>
            <CardDescription className="text-base">
              Access your business dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="businessId" className="text-sm font-medium">
                  Business ID *
                </Label>
                <Input
                  id="businessId"
                  data-testid="business-id-input"
                  placeholder="Enter your Business ID"
                  value={formData.businessId}
                  onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500">Find this in your registration email</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email *
                </Label>
                <Input
                  id="email"
                  data-testid="business-email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <Button
                data-testid="login-button"
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? "Logging in..." : "Login to Dashboard"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-gray-600 mb-3">
                Don't have a business account?
              </p>
              <Button
                data-testid="register-link-button"
                onClick={() => navigate("/register")}
                variant="outline"
                className="w-full"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Register Your Business
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/admin/login")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Admin Login →
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessLogin;
