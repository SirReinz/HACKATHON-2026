import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

export function SharedInquiryLoader() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [state, setState] = React.useState<"loading" | "not-found" | "access-denied">("loading")

  React.useEffect(() => {
    let cancelled = false

    const checkAndRedirect = async () => {
      if (!id) {
        setState("not-found")
        return
      }

      const { data, error } = await supabase
        .from("inquiries")
        .select("public")
        .eq("id", id)
        .single()

      if (cancelled) return

      if (error || !data) {
        setState("not-found")
        return
      }

      if (!data.public) {
        setState("access-denied")
        return
      }

      // Redirect to inquiry results view with this inquiry ID
      navigate(`/inquiry/results?inquiryId=${id}`)
    }

    void checkAndRedirect()

    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (state === "not-found") {
    return (
      <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-lg font-semibold">404</p>
            <p className="text-muted-foreground">This inquiry could not be found.</p>
            <Button onClick={() => navigate("/")} variant="default">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (state === "access-denied") {
    return (
      <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-lg font-semibold">Access Denied</p>
            <p className="text-muted-foreground">This inquiry is private and cannot be accessed.</p>
            <Button onClick={() => navigate("/")} variant="default">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="p-8 text-center text-muted-foreground">Loading inquiry...</CardContent>
      </Card>
    </main>
  )
}
