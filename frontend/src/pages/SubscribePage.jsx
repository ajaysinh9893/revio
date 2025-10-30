import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Check, Sparkles, Shield } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const SubscribePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const businessId = searchParams.get("business_id");

  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    if (!businessId) {
      navigate("/");
      return;
    }
    fetchPlans();
    loadRazorpayScript();
    
    // Auto-detect currency based on location (basic detection)
    const userLang = navigator.language || navigator.userLanguage;
    if (userLang.includes("en-CA") || userLang.includes("fr-CA")) {
      setSelectedCurrency("CAD");
    }
  }, [businessId]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscription/plans`);
      setPlans(response.data.plans);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load subscription plans");
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/subscription/apply-coupon`, {
        coupon_code: couponCode,
        plan_type: selectedPlan,
        currency: selectedCurrency
      });
      
      setCouponApplied(response.data);
      toast.success("Coupon applied successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Invalid coupon code");
      setCouponApplied(null);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPrice = () => {
    if (!plans) return 0;
    
    const plan = plans.find(p => p.type === selectedPlan);
    if (!plan) return 0;

    const price = plan.pricing[selectedCurrency].amount;
    
    if (couponApplied) {
      return couponApplied.final_price;
    }
    
    return price;
  };

  const getOriginalPrice = () => {
    if (!plans) return 0;
    const plan = plans.find(p => p.type === selectedPlan);
    return plan ? plan.pricing[selectedCurrency].amount : 0;
  };

  const getCurrencySymbol = () => {
    return selectedCurrency === "CAD" ? "$" : "₹";
  };

  const handleSubscribe = async () => {
    setLoading(true);

    try {
      // Step 1: Create order
      const orderResponse = await axios.post(`${API}/subscription/create-order`, {
        business_id: businessId,
        plan_type: selectedPlan,
        currency: selectedCurrency,
        coupon_code: couponCode || null
      });

      const { order_id, amount, currency, key_id } = orderResponse.data;

      // Step 2: Open Razorpay checkout
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: "Revio",
        description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Subscription`,
        order_id: order_id,
        handler: async function (response) {
          // Step 3: Verify payment
          try {
            const verifyResponse = await axios.post(`${API}/subscription/verify-payment`, {
              business_id: businessId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_type: selectedPlan,
              currency: selectedCurrency
            });

            toast.success("Subscription activated successfully!");
            
            // Redirect to dashboard
            setTimeout(() => {
              navigate(`/dashboard?id=${businessId}`);
            }, 2000);
          } catch (error) {
            console.error(error);
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: ""
        },
        theme: {
          color: "#3B82F6"
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            toast.error("Payment cancelled");
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to initiate payment");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Get started with Revio and boost your Google reviews
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pricing Plans */}
          <div className="lg:col-span-2">
            {/* Currency Selector */}
            <div className="mb-6 flex justify-center gap-4">
              <Button
                onClick={() => {
                  setSelectedCurrency("INR");
                  setCouponApplied(null);
                }}
                variant={selectedCurrency === "INR" ? "default" : "outline"}
                className="px-6"
              >
                India (₹)
              </Button>
              <Button
                onClick={() => {
                  setSelectedCurrency("CAD");
                  setCouponApplied(null);
                }}
                variant={selectedCurrency === "CAD" ? "default" : "outline"}
                className="px-6"
              >
                Canada ($)
              </Button>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Monthly Plan */}
              <Card 
                className={`border-2 cursor-pointer transition-all ${
                  selectedPlan === "monthly" 
                    ? "border-blue-500 shadow-lg" 
                    : "border-gray-200 hover:border-blue-300"
                }`}
                onClick={() => {
                  setSelectedPlan("monthly");
                  setCouponApplied(null);
                }}
              >
                <CardHeader>
                  <CardTitle className="text-2xl">Monthly</CardTitle>
                  <CardDescription>Pay month by month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {getCurrencySymbol()}{selectedCurrency === "CAD" ? "1.99" : "99"}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      Unlimited reviews
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      AI-powered generation
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      QR code access
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Yearly Plan */}
              <Card 
                className={`border-2 cursor-pointer transition-all relative ${
                  selectedPlan === "yearly" 
                    ? "border-purple-500 shadow-lg" 
                    : "border-gray-200 hover:border-purple-300"
                }`}
                onClick={() => {
                  setSelectedPlan("yearly");
                  setCouponApplied(null);
                }}
              >
                <div className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                  Save 37%
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Yearly</CardTitle>
                  <CardDescription>Best value - save more</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {getCurrencySymbol()}{selectedCurrency === "CAD" ? "14.99" : "799"}
                    </span>
                    <span className="text-gray-600">/year</span>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      Unlimited reviews
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      AI-powered generation
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      QR code access
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      Priority support
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Coupon Code */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Have a coupon code?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={loading || !couponCode.trim()}
                    variant="outline"
                  >
                    Apply
                  </Button>
                </div>
                {couponApplied && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      ✓ Coupon applied! You save {getCurrencySymbol()}{couponApplied.discount.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="border-0 shadow-xl sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-gray-700">
                  <span>Plan</span>
                  <span className="font-medium capitalize">{selectedPlan}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Duration</span>
                  <span className="font-medium">{selectedPlan === "monthly" ? "30 days" : "365 days"}</span>
                </div>
                
                {couponApplied && (
                  <>
                    <div className="flex justify-between text-gray-700">
                      <span>Original Price</span>
                      <span>{getCurrencySymbol()}{couponApplied.original_price}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{getCurrencySymbol()}{couponApplied.discount.toFixed(2)}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total</span>
                    <span>{getCurrencySymbol()}{getCurrentPrice()}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {loading ? "Processing..." : "Subscribe Now"}
                </Button>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>Secure payment via Razorpay</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
