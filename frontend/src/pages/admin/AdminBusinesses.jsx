import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Building2, Search, ArrowLeft, Filter, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminBusinesses = () => {
  const [businesses, setBusinesses] = useState([]);
  const [businessAlerts, setBusinessAlerts] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchBusinesses();
    fetchBusinessAlerts();
  }, [search, statusFilter]);

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      const response = await axios.get(`${API}/admin/businesses?${params.toString()}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let businessList = response.data.businesses || [];
      
      // Apply sorting
      if (sortBy === "newest") {
        businessList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (sortBy === "oldest") {
        businessList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      } else if (sortBy === "name") {
        businessList.sort((a, b) => a.name.localeCompare(b.name));
      }
      
      setBusinesses(businessList);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessAlerts = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/businesses/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Convert alerts array to object for easy lookup
      const alertsMap = {};
      response.data.alerts?.forEach(alert => {
        alertsMap[alert.business_id] = alert;
      });
      
      setBusinessAlerts(alertsMap);
    } catch (error) {
      console.error(error);
    }
  };

  const getRowColor = (businessId) => {
    const alert = businessAlerts[businessId];
    if (!alert) return "hover:bg-gray-50";
    
    const colors = {
      blue: "bg-blue-100 hover:bg-blue-200 border-l-8 border-l-blue-600",
      green: "bg-green-100 hover:bg-green-200 border-l-8 border-l-green-600",
      yellow: "bg-yellow-100 hover:bg-yellow-200 border-l-8 border-l-yellow-600",
      red: "bg-red-100 hover:bg-red-200 border-l-8 border-l-red-600"
    };
    
    return colors[alert.alert_color] || "hover:bg-gray-50";
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      expired: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.inactive;
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSortBy("newest");
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button onClick={() => navigate("/admin/dashboard")} variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Business Directory</h1>
                  <p className="text-sm text-gray-600">Manage all registered businesses</p>
                </div>
              </div>
              <NotificationBell />
            </div>

            {/* Filters and Search */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-12">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-12">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>

              {(search || statusFilter !== "all" || sortBy !== "newest") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 items-center text-xs">
              <span className="text-gray-600 font-medium">Legend:</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">New (24h)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-600">Expiring Soon</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600">Expired</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>All Businesses ({businesses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading businesses...</p>
                </div>
              ) : businesses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-4"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[150px]">Business Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Alert</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky right-0 bg-gray-50">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {businesses.map((business) => {
                        const alert = businessAlerts[business.id];
                        return (
                          <tr 
                            key={business.id} 
                            className={`transition-colors ${getRowColor(business.id)}`}
                          >
                            <td className="px-2 py-3">
                              {alert && (
                                <div 
                                  className={`w-3 h-3 rounded-full ${
                                    alert.alert_color === 'blue' ? 'bg-blue-600' :
                                    alert.alert_color === 'green' ? 'bg-green-600' :
                                    alert.alert_color === 'yellow' ? 'bg-yellow-600' :
                                    alert.alert_color === 'red' ? 'bg-red-600' :
                                    'bg-gray-400'
                                  }`}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[150px]">
                              <div>
                                <p className="font-medium text-gray-900">{business.name}</p>
                                <p className="text-xs text-gray-500">{business.category || "N/A"}</p>
                                {/* Show contact on mobile */}
                                <p className="text-xs text-gray-600 md:hidden mt-1">{business.phone || "No phone"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">{business.phone || "N/A"}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">{business.email || business.owner_email}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(business.subscription_status)}`}>
                                {business.subscription_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              {alert && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge 
                                      variant="outline"
                                      className={`
                                        ${alert.alert_color === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                        ${alert.alert_color === 'green' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                        ${alert.alert_color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}
                                        ${alert.alert_color === 'red' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                      `}
                                    >
                                      {alert.alert_type}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{alert.alert_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>
                            <td className="px-4 py-3 sticky right-0 bg-white">
                              <Button
                                onClick={() => navigate(`/admin/business/${business.id}`)}
                                size="sm"
                                variant="outline"
                                className="whitespace-nowrap"
                                data-testid="view-business-details"
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No businesses found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AdminBusinesses;
