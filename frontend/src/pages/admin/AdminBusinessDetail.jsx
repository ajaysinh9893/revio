import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Building2, CreditCard, BarChart3, Power, PowerOff, Edit } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminBusinessDetail = () => {
  const { businessId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchBusinessDetail();
  }, [businessId]);

  const fetchBusinessDetail = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/businesses/${businessId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load business details");
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const currentStatus = data.business.subscription_status;
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      
      await axios.put(`${API}/admin/businesses/${businessId}`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Business ${newStatus === "active" ? "activated" : "deactivated"} successfully`);
      fetchBusinessDetail(); // Refresh data
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to update business status");
    }
  };

  const handleEditClick = () => {
    const business = data.business;
    setEditForm({
      name: business.name || '',
      category: business.category || '',
      email: business.email || business.owner_email || '',
      phone: business.phone || '',
      address: business.address || ''
    });
    setShowEditDialog(true);
  };

  const handleEditSave = async () => {
    try {
      setSavingEdit(true);
      
      const response = await axios.put(
        `${API}/business/${businessId}`,
        editForm
      );
      
      if (response.data.success) {
        toast.success("Business information updated successfully!");
        setShowEditDialog(false);
        fetchBusinessDetail(); // Refresh data
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
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { business, analytics, tags } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button onClick={() => navigate("/admin/businesses")} variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
              <p className="text-sm text-gray-600">{business.category || "Business"}</p>
            </div>
            <Button
              data-testid="toggle-status-btn"
              onClick={handleToggleStatus}
              variant={business.subscription_status === "active" ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {business.subscription_status === "active" ? (
                <>
                  <PowerOff className="w-4 h-4" />
                  Deactivate Business
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  Activate Business
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Business Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Information
              </CardTitle>
              <Button
                onClick={handleEditClick}
                variant="outline"
                size="sm"
                data-testid="admin-edit-business-btn"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-base text-gray-900">{business.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Category</p>
                <p className="text-base text-gray-900">{business.category || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-base text-gray-900">{business.email || business.owner_email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Phone</p>
                <p className="text-base text-gray-900">{business.phone || "N/A"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="text-base text-gray-900">{business.address || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {business.subscription_status}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{analytics?.reviews_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">GPT Usage</p>
                <p className="text-2xl font-bold text-gray-900">{analytics?.gpt_usage_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">GPT Cost</p>
                <p className="text-2xl font-bold text-gray-900">${analytics?.gpt_cost || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-gray-900">${analytics?.total_paid || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                QR/NFC Tags ({tags?.length || 0})
              </CardTitle>
              <Button onClick={() => navigate("/admin/tags")} variant="outline" size="sm">
                Manage Tags
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tags && tags.length > 0 ? (
              <div className="space-y-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{tag.tag_id}</p>
                      <p className="text-xs text-gray-600">
                        Type: {tag.tag_type?.toUpperCase()} | Status: {tag.status} | Location: {tag.location || "N/A"}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tag.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                      tag.status === 'active' ? 'bg-green-100 text-green-800' :
                      tag.status === 'expired' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tag.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No tags assigned to this business</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Business Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Business Information</DialogTitle>
            <DialogDescription>
              Update business details (Admin Access)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-edit-name">Business Name *</Label>
              <Input
                id="admin-edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Enter business name"
                data-testid="admin-edit-business-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-edit-category">Category</Label>
              <Input
                id="admin-edit-category"
                value={editForm.category}
                onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                placeholder="e.g., Restaurant, Cafe, Retail"
                data-testid="admin-edit-business-category"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-edit-email">Email *</Label>
              <Input
                id="admin-edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                placeholder="business@example.com"
                data-testid="admin-edit-business-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-edit-phone">Phone</Label>
              <Input
                id="admin-edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                placeholder="+1234567890"
                data-testid="admin-edit-business-phone"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-edit-address">Address</Label>
              <Textarea
                id="admin-edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                placeholder="Enter full business address"
                rows={3}
                data-testid="admin-edit-business-address"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="admin-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditSave}
              disabled={savingEdit || !editForm.name || !editForm.email}
              data-testid="admin-save-edit"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusinessDetail;
