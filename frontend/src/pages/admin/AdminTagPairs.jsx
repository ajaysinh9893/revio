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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Search,
  Upload,
  History,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Tag,
  QrCode,
  Radio
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminTagPairs = () => {
  const [pairs, setPairs] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBusiness, setFilterBusiness] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showActivityLogDialog, setShowActivityLogDialog] = useState(false);
  
  const [selectedPair, setSelectedPair] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  
  // Form data
  const [createData, setCreateData] = useState({
    qr_id: "",
    nfc_id: "",
    notes: ""
  });
  
  const [bulkCreateData, setBulkCreateData] = useState({
    pairs: ""
  });
  
  const [assignData, setAssignData] = useState({
    business_id: "",
    business_location: ""
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [filterStatus, filterBusiness]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token");
      
      // Fetch tag pairs
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
      if (filterBusiness && filterBusiness !== "all") params.append("business_id", filterBusiness);
      
      const pairsRes = await axios.get(`${API}/admin/tag-pairs/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPairs(pairsRes.data.pairs || []);
      
      // Fetch stats
      const statsRes = await axios.get(`${API}/admin/tag-pairs/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(statsRes.data || {});
      
      // Fetch businesses
      const bizRes = await axios.get(`${API}/admin/businesses?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinesses(bizRes.data.businesses || []);
      
    } catch (error) {
      console.error(error);
      toast.error("Failed to load data");
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePair = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tag-pairs/create`, createData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair created successfully");
      setShowCreateDialog(false);
      setCreateData({ qr_id: "", nfc_id: "", notes: "" });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to create tag pair");
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      
      // Parse bulk data
      const lines = bulkCreateData.pairs.split('\n').filter(line => line.trim());
      const pairsArray = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          pairsArray.push({
            qr_id: parts[0],
            nfc_id: parts[1]
          });
        }
      }
      
      if (pairsArray.length === 0) {
        toast.error("No valid pairs found");
        return;
      }
      
      const response = await axios.post(`${API}/admin/tag-pairs/bulk-create`, {
        pairs: pairsArray
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Created ${response.data.created} pairs, skipped ${response.data.skipped}`);
      setShowBulkCreateDialog(false);
      setBulkCreateData({ pairs: "" });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to bulk create");
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tag-pairs/assign`, {
        pair_id: selectedPair.pair_id,
        ...assignData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair assigned successfully");
      setShowAssignDialog(false);
      setSelectedPair(null);
      setAssignData({ business_id: "", business_location: "" });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to assign");
    }
  };

  const handleReassign = async (pair) => {
    setSelectedPair(pair);
    setAssignData({
      business_id: pair.business_id || "",
      business_location: pair.business_location || ""
    });
    setShowAssignDialog(true);
  };

  const handleActivate = async (pair) => {
    if (!confirm(`Activate tag pair ${pair.pair_id}?`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tag-pairs/activate/${pair.pair_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair activated");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to activate");
    }
  };

  const handleDeactivate = async (pair) => {
    if (!confirm(`Deactivate tag pair ${pair.pair_id}?`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tag-pairs/deactivate/${pair.pair_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair deactivated");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to deactivate");
    }
  };

  const handleDelete = async (pair) => {
    if (!confirm(`Delete tag pair ${pair.pair_id}? This cannot be undone.`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.delete(`${API}/admin/tag-pairs/delete/${pair.pair_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair deleted");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  const handleReset = async (pair) => {
    if (!confirm(`Reset tag pair ${pair.pair_id} to unassigned state?`)) return;
    
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(`${API}/admin/tag-pairs/reset/${pair.pair_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Tag pair reset successfully");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to reset");
    }
  };

  const fetchActivityLog = async (pair) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/tag-pairs/activity-log/${pair.pair_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivityLog(response.data.activities || []);
      setSelectedPair(pair);
      setShowActivityLogDialog(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load activity log");
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      unassigned: { color: "bg-gray-100 text-gray-800", label: "Unassigned" },
      assigned: { color: "bg-blue-100 text-blue-800", label: "Assigned" },
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-yellow-100 text-yellow-800", label: "Inactive" },
      deleted: { color: "bg-red-100 text-red-800", label: "Deleted" }
    };
    
    const { color, label } = config[status] || config.unassigned;
    
    return (
      <Badge className={`${color} border-0`} data-testid={`status-badge-${status}`}>
        {label}
      </Badge>
    );
  };

  const filteredPairs = pairs.filter(pair => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      pair.pair_id?.toLowerCase().includes(search) ||
      pair.qr_id?.toLowerCase().includes(search) ||
      pair.nfc_id?.toLowerCase().includes(search) ||
      pair.business_name?.toLowerCase().includes(search) ||
      pair.business_location?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <Button 
            onClick={() => navigate("/admin/dashboard")} 
            variant="ghost" 
            size="sm" 
            className="mb-4"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">QR & NFC Tag Inventory</h1>
              <p className="text-sm text-gray-600 mt-1">Manage tag pairs for business locations</p>
            </div>
            
            <div className="flex gap-3">
              <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkCreateDialog(true)}
                  data-testid="bulk-upload-btn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Upload
                </Button>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Tag Pairs</DialogTitle>
                    <DialogDescription>
                      Enter one pair per line: QR_ID NFC_ID (space-separated)
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleBulkCreate}>
                    <div className="py-4">
                      <Label>Tag Pairs (one per line)</Label>
                      <Textarea
                        data-testid="bulk-pairs-input"
                        placeholder="QR-001 NFC-001&#10;QR-002 NFC-002&#10;QR-003 NFC-003"
                        value={bulkCreateData.pairs}
                        onChange={(e) => setBulkCreateData({ pairs: e.target.value })}
                        rows={12}
                        className="font-mono text-sm mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Example: QR-A1B2 NFC-X1Y2
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowBulkCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="submit-bulk-upload-btn">
                        Upload Pairs
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <Button onClick={() => setShowCreateDialog(true)} data-testid="create-pair-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Pair
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Tag Pair</DialogTitle>
                    <DialogDescription>
                      Link a QR code and NFC tag together
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePair}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>QR Code ID *</Label>
                        <div className="relative">
                          <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            data-testid="qr-id-input"
                            placeholder="e.g., QR-A1B2C3D4"
                            value={createData.qr_id}
                            onChange={(e) => setCreateData({ ...createData, qr_id: e.target.value })}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label>NFC Tag ID *</Label>
                        <div className="relative">
                          <Radio className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            data-testid="nfc-id-input"
                            placeholder="e.g., NFC-X1Y2Z3"
                            value={createData.nfc_id}
                            onChange={(e) => setCreateData({ ...createData, nfc_id: e.target.value })}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          data-testid="notes-input"
                          placeholder="Additional information..."
                          value={createData.notes}
                          onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="submit-create-btn">
                        Create Pair
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Pairs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Unassigned</p>
                <p className="text-2xl font-bold text-gray-500 mt-1">{stats.unassigned || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Assigned</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.assigned || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.active || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.inactive || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  data-testid="search-input"
                  placeholder="Search by Pair ID, QR, NFC, or Business..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterStatus || "all"} onValueChange={(val) => setFilterStatus(val === "all" ? "" : val)}>
                <SelectTrigger data-testid="filter-status-select">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterBusiness || "all"} onValueChange={(val) => setFilterBusiness(val === "all" ? "" : val)}>
                <SelectTrigger data-testid="filter-business-select">
                  <SelectValue placeholder="All Businesses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Businesses</SelectItem>
                  {businesses.map((biz) => (
                    <SelectItem key={biz.id} value={biz.id}>
                      {biz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tag Pairs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tag Pairs ({filteredPairs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading tag pairs...</p>
              </div>
            ) : filteredPairs.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No tag pairs found</p>
                <Button 
                  onClick={() => setShowCreateDialog(true)} 
                  variant="outline" 
                  className="mt-4"
                  data-testid="create-first-pair-btn"
                >
                  Create Your First Pair
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Pair ID
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        QR ID
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        NFC ID
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Linked Business
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPairs.map((pair) => (
                      <tr 
                        key={pair.pair_id} 
                        className="hover:bg-gray-50 transition-colors"
                        data-testid={`pair-row-${pair.pair_id}`}
                      >
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {pair.pair_id}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm text-gray-700">{pair.qr_id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm text-gray-700">{pair.nfc_id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-900 font-medium">
                            {pair.business_name || "-"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">
                            {pair.business_location || "-"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(pair.status)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {pair.status === "unassigned" && (
                              <Button
                                data-testid={`assign-btn-${pair.pair_id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPair(pair);
                                  setShowAssignDialog(true);
                                }}
                              >
                                Assign
                              </Button>
                            )}
                            
                            {(pair.status === "assigned" || pair.status === "active" || pair.status === "inactive") && (
                              <>
                                <Button
                                  data-testid={`reassign-btn-${pair.pair_id}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReassign(pair)}
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Reassign
                                </Button>
                                
                                <Button
                                  data-testid={`reset-btn-${pair.pair_id}`}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReset(pair)}
                                  title="Reset to unassigned"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Reset
                                </Button>
                              </>
                            )}
                            
                            {(pair.status === "assigned" || pair.status === "inactive") && (
                              <Button
                                data-testid={`activate-btn-${pair.pair_id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleActivate(pair)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Power className="w-3 h-3 mr-1" />
                                Activate
                              </Button>
                            )}
                            
                            {pair.status === "active" && (
                              <Button
                                data-testid={`deactivate-btn-${pair.pair_id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeactivate(pair)}
                                className="text-yellow-600 hover:text-yellow-700"
                              >
                                <PowerOff className="w-3 h-3 mr-1" />
                                Deactivate
                              </Button>
                            )}
                            
                            <Button
                              data-testid={`history-btn-${pair.pair_id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => fetchActivityLog(pair)}
                              title="View Activity Log"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              data-testid={`delete-btn-${pair.pair_id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(pair)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedPair?.business_id ? "Reassign" : "Assign"} Tag Pair to Business
              </DialogTitle>
              <DialogDescription>
                Pair ID: {selectedPair?.pair_id}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssign}>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Business *</Label>
                  <Select 
                    value={assignData.business_id} 
                    onValueChange={(val) => setAssignData({ ...assignData, business_id: val })}
                  >
                    <SelectTrigger data-testid="assign-business-select">
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((biz) => (
                        <SelectItem key={biz.id} value={biz.id}>
                          {biz.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Business Location</Label>
                  <Input
                    data-testid="business-location-input"
                    placeholder="e.g., 123 Main St, San Francisco, CA"
                    value={assignData.business_location}
                    onChange={(e) => setAssignData({ ...assignData, business_location: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAssignDialog(false);
                    setSelectedPair(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="submit-assign-btn">
                  {selectedPair?.business_id ? "Reassign" : "Assign"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Activity Log Dialog */}
        <Dialog open={showActivityLogDialog} onOpenChange={setShowActivityLogDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Activity Log: {selectedPair?.pair_id}</DialogTitle>
              <DialogDescription>
                Complete history of all changes
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto max-h-96">
              {activityLog.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No activity recorded yet</p>
              ) : (
                <div className="space-y-4">
                  {activityLog.map((activity, idx) => (
                    <div 
                      key={idx} 
                      className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r"
                      data-testid={`activity-${idx}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-semibold">
                            {activity.action}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            by {activity.performed_by}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      {activity.notes && (
                        <p className="text-sm text-gray-700 mt-2">{activity.notes}</p>
                      )}
                      
                      {activity.previous_state && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                            View Details
                          </summary>
                          <div className="mt-2 p-2 bg-white rounded text-xs font-mono">
                            <div className="mb-1">
                              <strong>Before:</strong>
                              <pre className="text-gray-600 mt-1">
                                {JSON.stringify(activity.previous_state, null, 2)}
                              </pre>
                            </div>
                            {activity.new_state && (
                              <div>
                                <strong>After:</strong>
                                <pre className="text-gray-600 mt-1">
                                  {JSON.stringify(activity.new_state, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
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

export default AdminTagPairs;
