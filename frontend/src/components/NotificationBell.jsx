import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await axios.get(`${API}/admin/notifications/recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const markAsRead = async (notificationIds) => {
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(
        `${API}/admin/notifications/mark-read`,
        { notification_ids: notificationIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      await axios.post(
        `${API}/admin/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDropdownOpen = (isOpen) => {
    setOpen(isOpen);
    
    if (isOpen && unreadCount > 0) {
      // Mark currently visible unread notifications as read
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);
      
      if (unreadIds.length > 0) {
        setTimeout(() => markAsRead(unreadIds), 1000);
      }
    }
  };

  const getNotificationColor = (type) => {
    const colors = {
      NEW_BUSINESS: "bg-blue-100 text-blue-800 border-blue-200",
      SUBSCRIPTION_EXPIRING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      SUBSCRIPTION_EXPIRED: "bg-red-100 text-red-800 border-red-200",
      TAG_PENDING: "bg-purple-100 text-purple-800 border-purple-200",
      SUPPORT_TICKET: "bg-orange-100 text-orange-800 border-orange-200"
    };
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" data-testid="notification-bell">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-b hover:bg-gray-50 transition-colors ${
                  !notif.is_read ? "bg-blue-50" : ""
                }`}
                data-testid={`notification-${notif.id}`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      notif.type === "NEW_BUSINESS" ? "bg-blue-500" :
                      notif.type === "SUBSCRIPTION_EXPIRING" ? "bg-yellow-500" :
                      notif.type === "SUBSCRIPTION_EXPIRED" ? "bg-red-500" :
                      notif.type === "TAG_PENDING" ? "bg-purple-500" :
                      "bg-gray-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {notif.title}
                      </p>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${getNotificationColor(notif.type)}`}
                    >
                      {notif.type.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
