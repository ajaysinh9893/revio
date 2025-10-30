import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, QrCode as QrCodeIcon } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewQRCode = () => {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const navigate = useNavigate();

  const businessId = new URLSearchParams(window.location.search).get('id') || localStorage.getItem('business_id');

  useEffect(() => {
    if (businessId) {
      fetchBusinessData();
      setQrImageUrl(`${API}/business/${businessId}/qr`);
    } else {
      navigate('/');
    }
  }, [businessId]);

  const fetchBusinessData = async () => {
    try {
      const response = await axios.get(`${API}/business/${businessId}`);
      setBusiness(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load business data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = async () => {
    try {
      const response = await axios.get(qrImageUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${business?.name || 'business'}-qr-code.png`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("QR Code downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download QR code");
    }
  };

  const handleShare = () => {
    if (navigator.share && business) {
      navigator.share({
        title: `Review ${business.name}`,
        text: `Leave a review for ${business.name}`,
        url: business.qr_code
      }).catch(err => console.log('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(business?.qr_code || '');
      toast.success("Review link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading QR Code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-2xl mx-auto">
        <Button 
          onClick={() => navigate(`/dashboard?id=${businessId}`)} 
          variant="outline" 
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
              <QrCodeIcon className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Your QR Code</CardTitle>
            <CardDescription>
              Share this with customers to collect reviews
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {business && (
              <>
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{business.name}</h3>
                  <p className="text-sm text-gray-600">{business.category || "Business"}</p>
                </div>

                <div className="bg-white rounded-xl p-8 shadow-lg">
                  <div className="flex justify-center">
                    <img
                      src={qrImageUrl}
                      alt="QR Code"
                      className="w-64 h-64"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%23eee" width="256" height="256"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">QR Code</text></svg>';
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleDownloadQR}
                    variant="outline"
                    className="h-12"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download QR
                  </Button>
                  <Button
                    onClick={handleShare}
                    className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Link
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">Review Link:</p>
                  <p className="text-sm text-blue-700 break-all">{business.qr_code}</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900">
                    <strong>💡 Tip:</strong> Print this QR code and display it at your business location for easy customer access!
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewQRCode;
