import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, DollarSign, Tag, TrendingUp, Bell, LogOut, Users, CreditCard, LifeBuoy } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchStats();
    fetchNotifications();
    fetchBadges();
    
    // Refresh badges every 30 seconds
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 401) {
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/dashboard/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBadges = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/notifications/badges`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBadges(response.data || {});
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revio Admin</h1>
            <p className="text-sm text-gray-600">Manage your platform</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate("/admin/businesses")} 
              variant="outline"
              className="relative"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Businesses
              {(badges.new_businesses > 0 || badges.expiring_subscriptions > 0 || badges.expired_subscriptions > 0) && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    badges.expired_subscriptions > 0 ? 'bg-red-500' :
                    badges.expiring_subscriptions > 0 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}></span>
                </span>
              )}
            </Button>
            <Button 
              onClick={() => navigate("/admin/tag-pairs")} 
              variant="outline"
              className="relative"
            >
              <Tag className="w-4 h-4 mr-2" />
              Tag Pairs
              {badges.pending_tags > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
              )}
            </Button>
            <Button onClick={() => navigate("/admin/tickets")} variant="outline">
              <LifeBuoy className="w-4 h-4 mr-2" />
              Tickets
            </Button>
            <NotificationBell />
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Total Businesses</CardTitle>
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats?.total_businesses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Active Subscriptions</CardTitle>
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats?.active_subscriptions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">GPT Usage & Cost</CardTitle>
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats?.gpt_usage_count || 0}</div>
              <p className="text-sm text-gray-600 mt-1">${stats?.gpt_cost || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">${stats?.total_revenue || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Monthly: ${stats?.monthly_revenue || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Notifications</CardTitle>
                <Bell className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notif, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                        <p className="text-xs text-gray-600">{notif.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No notifications</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => navigate("/admin/businesses")} className="w-full justify-start">
                <Building2 className="w-4 h-4 mr-2" />
                View All Businesses
              </Button>
              <Button onClick={() => navigate("/admin/tags")} variant="outline" className="w-full justify-start">
                <Tag className="w-4 h-4 mr-2" />
                Manage Tags (Legacy)
              </Button>
              <Button onClick={() => navigate("/admin/tag-pairs")} variant="default" className="w-full justify-start">
                <Tag className="w-4 h-4 mr-2" />
                Tag Pairs Inventory
              </Button>
              <Button onClick={() => navigate("/admin/tickets")} variant="outline" className="w-full justify-start">
                <LifeBuoy className="w-4 h-4 mr-2" />
                Support Tickets
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
