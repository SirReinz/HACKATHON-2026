import { Link, Navigate, Route, Routes } from "react-router-dom"
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react"
import { SignInPage } from "@/pages/SignInPage"
import { SignUpPage } from "@/pages/SignUpPage"

function HomePage() {
  return (
    <main className="min-h-svh bg-gradient-to-br from-emerald-50 via-background to-cyan-100 p-6">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-xl border bg-card/80 p-4 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Hackathon 2026</h1>
        <SignedIn>
          <UserButton afterSignOutUrl="/sign-in" />
        </SignedIn>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <SignedIn>
          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">You are logged in</h2>
            <p className="mt-2 text-muted-foreground">
              Welcome to your Clerk-enabled React + TypeScript app.
            </p>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">Authentication required</h2>
            <p className="mt-2 text-muted-foreground">
              Please sign in or create an account to continue.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                to="/sign-in"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
              >
                Register
              </Link>
            </div>
          </div>
        </SignedOut>
      </div>
    </main>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
