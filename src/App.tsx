import { SignedIn, SignedOut } from "@clerk/clerk-react"
import { Navigate, Route, Routes } from "react-router-dom"
import { InquiryFlowProvider } from "@/context/InquiryFlowContext"
import { DashboardPage } from "@/pages/DashboardPage"
import { FreeExploreDetailsPage } from "@/pages/FreeExploreDetailsPage"
import { ResultsCarouselPage } from "@/pages/ResultsCarousel"
import { SignInPage } from "@/pages/SignInPage"
import { SignUpPage } from "@/pages/SignUpPage"
import { LandingPage } from "@/pages/LandingPage"
import { MapPage } from "@/pages/MapPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { SharedInquiryLoader } from "@/pages/SharedInquiryLoader"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

export function App() {
  return (
    <InquiryFlowProvider>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <SignedIn>
                <Navigate to="/dashboard" replace />
              </SignedIn>
              <SignedOut>
                <LandingPage />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inquiry/new"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inquiry/results"
          element={
            <ProtectedRoute>
              <ResultsCarouselPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/details"
          element={
            <ProtectedRoute>
              <FreeExploreDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={<Navigate to="/explore" replace />}
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/shared/:id" element={<SharedInquiryLoader />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </InquiryFlowProvider>
  )
}

export default App
