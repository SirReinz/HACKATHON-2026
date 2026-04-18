import { Link } from "react-router-dom"
import { SignUp } from "@clerk/clerk-react"

export function SignUpPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-background via-muted/60 to-background p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-3xl border bg-card/80 p-3 shadow-sm backdrop-blur-sm">
          <SignUp
            path="/sign-up"
            signInUrl="/sign-in"
            routing="path"
            forceRedirectUrl="/map"
          />
        </div>
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
