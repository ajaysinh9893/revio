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
import { toast } from "sonner";
import { ArrowLeft, LifeBuoy, Search, Clock, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [filterPriority, setFilterPriority] = useState(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updateData, setUpdateData] = useState({
    status: "",
    priority: "",
    admin_notes: ""
  });
  const [stats, setStats] = useState({ open_count: 0, pending_count: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchTickets();
  }, [filterStatus, filterPriority]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterPriority) params.append("priority", filterPriority);
      
      const response = await axios.get(`${API}/admin/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data.tickets || []);
      setStats({
        open_count: response.data.open_count || 0,
        pending_count: response.data.pending_count || 0
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load tickets");
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const openTicketDetail = async (ticket) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/tickets/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setUpdateData({
        status: response.data.status,
        priority: response.data.priority,
        admin_notes: response.data.admin_notes || ""
      });
      setShowDetailDialog(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load ticket details");
    }
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      await axios.put(`${API}/admin/tickets/${selectedTicket.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Ticket updated successfully");
      setShowDetailDialog(false);
      setSelectedTicket(null);
      fetchTickets();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Failed to update ticket");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      open: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800"
    };
    const icons = {
      open: <AlertCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      resolved: <CheckCircle2 className="w-3 h-3" />,
      closed: <CheckCircle2 className="w-3 h-3" />
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${colors[status] || colors.open}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || colors.medium}`}>
        {priority}
      </span>
    );
  };

  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(search) ||
      ticket.business_name?.toLowerCase().includes(search) ||
      ticket.business_email?.toLowerCase().includes(search)
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <LifeBuoy className="w-6 h-6" />
                Support Tickets
              </h1>
              <p className="text-sm text-gray-600">Manage customer support requests</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.open_count}</p>
                <p className="text-xs text-gray-600">Open</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.pending_count}</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
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
                    data-testid="search-tickets-input"
                    placeholder="Search by subject, business name, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus || "all"} onValueChange={(val) => setFilterStatus(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-full md:w-48" data-testid="filter-status-select">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority || "all"} onValueChange={(val) => setFilterPriority(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-full md:w-48" data-testid="filter-priority-select">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              All Tickets ({filteredTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <LifeBuoy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No tickets found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => openTicketDetail(ticket)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          From: {ticket.business_name} ({ticket.business_email})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{ticket.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                      {ticket.updated_at !== ticket.created_at && (
                        <span>Updated: {new Date(ticket.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
              <DialogDescription>
                Manage and respond to support ticket
              </DialogDescription>
            </DialogHeader>
            {selectedTicket && (
              <form onSubmit={handleUpdateTicket}>
                <div className="space-y-4">
                  {/* Ticket Info */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">{selectedTicket.subject}</h3>
                    <p className="text-sm text-gray-600">
                      From: <span className="font-medium">{selectedTicket.business_name}</span>
                    </p>
                    <p className="text-sm text-gray-600">Email: {selectedTicket.business_email}</p>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <Label>Description</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                  </div>

                  {/* Update Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <Select value={updateData.status} onValueChange={(val) => setUpdateData({...updateData, status: val})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={updateData.priority} onValueChange={(val) => setUpdateData({...updateData, priority: val})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div>
                    <Label>Admin Notes (Internal)</Label>
                    <Textarea
                      placeholder="Add notes about this ticket..."
                      value={updateData.admin_notes}
                      onChange={(e) => setUpdateData({...updateData, admin_notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowDetailDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Update Ticket
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminTickets;
