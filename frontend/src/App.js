import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BusinessLogin from "@/pages/BusinessLogin";
import HomePage from "@/pages/HomePage";
import ReviewPage from "@/pages/ReviewPage";
import ProfileDashboard from "@/pages/ProfileDashboard";
import ViewQRCode from "@/pages/ViewQRCode";
import SubscribePage from "@/pages/SubscribePage";
import GoogleVerification from "@/pages/GoogleVerification";
import GoogleBusinessDashboard from "@/pages/GoogleBusinessDashboard";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBusinesses from "@/pages/admin/AdminBusinesses";
import AdminBusinessDetail from "@/pages/admin/AdminBusinessDetail";
import AdminTagPairs from "@/pages/admin/AdminTagPairs";
import AdminTickets from "@/pages/admin/AdminTickets";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BusinessLogin />} />
          <Route path="/register" element={<HomePage />} />
          <Route path="/review/:businessId" element={<ReviewPage />} />
          <Route path="/dashboard" element={<ProfileDashboard />} />
          <Route path="/view-qr" element={<ViewQRCode />} />
          <Route path="/subscribe" element={<SubscribePage />} />
          <Route path="/google-verification" element={<GoogleVerification />} />
          <Route path="/google-dashboard" element={<GoogleBusinessDashboard />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/businesses" element={<AdminBusinesses />} />
          <Route path="/admin/business/:businessId" element={<AdminBusinessDetail />} />
          <Route path="/admin/tag-pairs" element={<AdminTagPairs />} />
          <Route path="/admin/tickets" element={<AdminTickets />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </div>
  );
}

export default App;
