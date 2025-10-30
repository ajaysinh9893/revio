import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Tag, QrCode, Search, Upload, History, Trash2, RotateCcw, XCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminTags = () => {
  const [tags, setTags] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showScrapDialog, setShowScrapDialog] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagHistory, setTagHistory] = useState([]);
  const [formData, setFormData] = useState({
    tag_type: "qr",
    tag_id: "",
    quantity: 1
  });
  const [bulkUploadData, setBulkUploadData] = useState({
    tag_type: "qr",
    tag_ids: ""
  });
  const [assignData, setAssignData] = useState({
    business_id: "",
    location: "",
    expires_in_days: 365
  });
  const [scrapData, setScrapData] = useState({
    reason: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchTags();
    fetchBusinesses();
  }, [filterStatus]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      
      const response = await axios.get(`${API}/admin/tags?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTags(response.data.tags || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load tags");
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/businesses?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinesses(response.data.businesses || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tags/create`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${formData.quantity} tag(s) created successfully`);
      setShowCreateDialog(false);
      setFormData({ tag_type: "qr", tag_id: "", quantity: 1 });
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to create tags");
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      const tag_ids = bulkUploadData.tag_ids.split('\n').map(id => id.trim()).filter(id => id);
      
      const response = await axios.post(`${API}/admin/tags/bulk-upload`, {
        tag_type: bulkUploadData.tag_type,
        tag_ids
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message);
      setShowBulkUploadDialog(false);
      setBulkUploadData({ tag_type: "qr", tag_ids: "" });
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to upload tags");
    }
  };

  const handleAssignTag = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tags/assign`, {
        tag_id: selectedTag.id,
        ...assignData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag assigned successfully");
      setShowAssignDialog(false);
      setSelectedTag(null);
      setAssignData({ business_id: "", location: "", expires_in_days: 365 });
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to assign tag");
    }
  };

  const handleUnassignTag = async (tag) => {
    if (!confirm(`Unassign tag ${tag.tag_id}?`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tags/unassign`, {
        tag_id: tag.tag_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag unassigned successfully");
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to unassign tag");
    }
  };

  const handleScrapTag = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tags/scrap`, {
        tag_id: selectedTag.tag_id,
        reason: scrapData.reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag scrapped successfully");
      setShowScrapDialog(false);
      setSelectedTag(null);
      setScrapData({ reason: "" });
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to scrap tag");
    }
  };

  const handleResetTag = async (tag) => {
    if (!confirm(`Reset tag ${tag.tag_id} to inactive state?`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tags/reset`, {
        tag_id: tag.tag_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag reset successfully");
      fetchTags();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to reset tag");
    }
  };

  const fetchTagHistory = async (tag) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/tags/${tag.tag_id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTagHistory(response.data.history || []);
      setSelectedTag(tag);
      setShowHistoryDialog(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load tag history");
    }
  };

  const openAssignDialog = (tag) => {
    setSelectedTag(tag);
    setShowAssignDialog(true);
  };

  const openScrapDialog = (tag) => {
    setSelectedTag(tag);
    setShowScrapDialog(true);
  };

  const getStatusBadge = (status) => {
    const colors = {
      inactive: "bg-gray-100 text-gray-800",
      active: "bg-green-100 text-green-800",
      pending: "bg-blue-100 text-blue-800",
      scrapped: "bg-red-100 text-red-800"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.inactive}`}>
        {status}
      </span>
    );
  };

  const filteredTags = tags.filter(tag => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      tag.tag_id?.toLowerCase().includes(search) ||
      tag.tag_type?.toLowerCase().includes(search) ||
      tag.business_id?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button onClick={() => navigate("/admin/dashboard")} variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QR/NFC Tag Inventory</h1>
              <p className="text-sm text-gray-600">Manage physical tags for businesses</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="bulk-upload-btn">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Tags</DialogTitle>
                    <DialogDescription>
                      Upload multiple tag IDs (one per line)
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleBulkUpload}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Tag Type</Label>
                        <Select value={bulkUploadData.tag_type} onValueChange={(val) => setBulkUploadData({...bulkUploadData, tag_type: val})}>
                          <SelectTrigger data-testid="bulk-tag-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qr">QR Code</SelectItem>
                            <SelectItem value="nfc">NFC Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tag IDs (one per line)</Label>
                        <Textarea
                          data-testid="bulk-tag-ids-input"
                          placeholder="QR-001\nQR-002\nQR-003"
                          value={bulkUploadData.tag_ids}
                          onChange={(e) => setBulkUploadData({...bulkUploadData, tag_ids: e.target.value})}
                          rows={10}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowBulkUploadDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="submit-bulk-upload-btn">Upload Tags</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="create-tag-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tags
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Tags</DialogTitle>
                    <DialogDescription>
                      Generate new QR or NFC tags for inventory
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateTag}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Tag Type</Label>
                        <Select value={formData.tag_type} onValueChange={(val) => setFormData({...formData, tag_type: val})}>
                          <SelectTrigger data-testid="tag-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qr">QR Code</SelectItem>
                            <SelectItem value="nfc">NFC Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tag ID (Optional)</Label>
                        <Input
                          data-testid="tag-id-input"
                          placeholder="Leave empty for auto-generation"
                          value={formData.tag_id}
                          onChange={(e) => setFormData({...formData, tag_id: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          data-testid="tag-quantity-input"
                          type="number"
                          min="1"
                          max="100"
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="submit-create-tag-btn">Create</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="search-tags-input"
                    placeholder="Search by tag ID, type, or business..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus || "all"} onValueChange={(val) => setFilterStatus(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-full md:w-48" data-testid="filter-status-select">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scrapped">Scrapped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tags Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags Inventory ({filteredTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading tags...</p>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-12">
                <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No tags found</p>
                <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="mt-4">
                  Create Your First Tag
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Tag ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Business</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTags.map((tag) => {
                      const business = businesses.find(b => b.id === tag.business_id);
                      return (
                        <tr key={tag.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-mono text-gray-900">{tag.tag_id}</td>
                          <td className="py-3 px-4 text-sm text-gray-900 uppercase">{tag.tag_type}</td>
                          <td className="py-3 px-4">{getStatusBadge(tag.status)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {business ? business.name : tag.business_id || "-"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{tag.location || "-"}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {tag.status === "inactive" && (
                                <Button
                                  data-testid={`assign-tag-btn-${tag.id}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAssignDialog(tag)}
                                >
                                  Assign
                                </Button>
                              )}
                              {(tag.status === "pending" || tag.status === "active") && (
                                <Button
                                  data-testid={`unassign-tag-btn-${tag.id}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnassignTag(tag)}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Unassign
                                </Button>
                              )}
                              {tag.status !== "scrapped" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openScrapDialog(tag)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResetTag(tag)}
                                title="Reset tag"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchTagHistory(tag)}
                                title="View history"
                              >
                                <History className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Tag Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Tag to Business</DialogTitle>
              <DialogDescription>
                Tag ID: {selectedTag?.tag_id}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignTag}>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Business</Label>
                  <Select value={assignData.business_id} onValueChange={(val) => setAssignData({...assignData, business_id: val})}>
                    <SelectTrigger data-testid="assign-business-select">
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((business) => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    data-testid="tag-location-input"
                    placeholder="e.g., Front counter, Entrance"
                    value={assignData.location}
                    onChange={(e) => setAssignData({...assignData, location: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Expires In (Days)</Label>
                  <Input
                    data-testid="tag-expires-input"
                    type="number"
                    min="1"
                    value={assignData.expires_in_days}
                    onChange={(e) => setAssignData({...assignData, expires_in_days: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAssignDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="submit-assign-tag-btn">Assign Tag</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Scrap Tag Dialog */}
        <Dialog open={showScrapDialog} onOpenChange={setShowScrapDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scrap Tag</DialogTitle>
              <DialogDescription>
                Permanently deactivate tag: {selectedTag?.tag_id}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleScrapTag}>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Reason for Scrapping *</Label>
                  <Textarea
                    data-testid="scrap-reason-input"
                    placeholder="e.g., Stolen, Damaged, Returned"
                    value={scrapData.reason}
                    onChange={(e) => setScrapData({reason: e.target.value})}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowScrapDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" data-testid="submit-scrap-btn">Scrap Tag</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tag History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tag History: {selectedTag?.tag_id}</DialogTitle>
              <DialogDescription>
                Complete activation and assignment history
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
              {tagHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No history available</p>
              ) : (
                <div className="space-y-3">
                  {tagHistory.map((record, idx) => (
                    <div key={idx} className="border-l-2 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{record.action}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">By: {record.admin_email}</p>
                      {record.details && (
                        <p className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(record.details)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminTags;
