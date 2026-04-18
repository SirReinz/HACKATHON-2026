import { Link } from "react-router-dom"
import { SignUp } from "@clerk/clerk-react"

export function SignUpPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-background via-cyan-50 to-emerald-100 p-6">
      <div className="w-full max-w-md space-y-4">
        <SignUp path="/sign-up" signInUrl="/sign-in" routing="path" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
