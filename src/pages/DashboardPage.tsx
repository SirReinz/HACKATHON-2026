import * as React from "react"
import { useUser } from "@clerk/clerk-react"
import { useNavigate } from "react-router-dom"

import { UserProfileBox } from "@/components/UserProfileBox"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from "@/lib/supabase"

type InquiryRow = {
  id: string
  business_type: string
  target_audience: string
  spending_bracket: string
  created_at: string
  results_data: {
    suburbs?: string[]
  } | null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [inquiries, setInquiries] = React.useState<InquiryRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const loadInquiries = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("inquiries")
        .select("id, business_type, target_audience, spending_bracket, created_at, results_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (cancelled) {
        return
      }

      setInquiries(Array.isArray(data) ? (data as InquiryRow[]) : [])
      setLoading(false)
    }

    void loadInquiries()

    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <main className="min-h-svh bg-linear-to-br from-slate-100 via-white to-cyan-100 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-border/50 bg-background/65 shadow-xl backdrop-blur-md">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-3xl">Saved Inquiries</CardTitle>
              <CardDescription>
                Review prior location evaluations and start a new tailored inquiry.
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/explore")}>
                Free Explore
              </Button>
              <Button className="rounded-2xl" onClick={() => navigate("/inquiry/new")}>
                New Location Inquiry
              </Button>
            </div>
          </CardHeader>
        </Card>

        <ScrollArea className="h-[70svh] pr-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <Card className="border-border/50 bg-background/65 backdrop-blur-md">
                <CardContent className="p-6 text-sm text-muted-foreground">Loading inquiries...</CardContent>
              </Card>
            ) : null}

            {!loading && !inquiries.length ? (
              <Card className="border-border/50 bg-background/65 backdrop-blur-md md:col-span-2 xl:col-span-3">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No saved inquiries yet. Start your first location intelligence run.
                </CardContent>
              </Card>
            ) : null}

            {inquiries.map((inquiry) => (
              <Card key={inquiry.id} className="border-border/50 bg-background/65 shadow-lg backdrop-blur-md">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">{inquiry.business_type}</CardTitle>
                  <CardDescription>
                    {new Date(inquiry.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Audience:</span> {inquiry.target_audience}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Spend:</span> {inquiry.spending_bracket}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Suburbs:</span>{" "}
                    {(inquiry.results_data?.suburbs ?? []).join(", ") || "Not available"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="fixed bottom-4 left-4 z-40 lg:bottom-6 lg:left-6">
        <UserProfileBox />
      </div>
    </main>
  )
}
