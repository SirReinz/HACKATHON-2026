import { Link } from "react-router-dom"
import { SignIn } from "@clerk/clerk-react"

export function SignInPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-background via-emerald-50 to-cyan-100 p-6">
      <div className="w-full max-w-md space-y-4">
        <SignIn path="/sign-in" signUpUrl="/sign-up" routing="path" />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link className="font-medium text-primary hover:underline" to="/sign-up">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
