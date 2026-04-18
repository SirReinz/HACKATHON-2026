import * as React from "react"
import { useAuth, useUser } from "@clerk/clerk-react"

import { createSupabaseWithAccessToken } from "@/lib/supabase"

export function UserSync() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()

  React.useEffect(() => {
    if (!userLoaded || !isSignedIn || !user) {
      return
    }

    let cancelled = false

    const syncProfile = async () => {
      const token = await getToken({ template: "supabase" })
      if (!token) {
        return
      }

      const authedSupabase = createSupabaseWithAccessToken(token)

      const { data: existingProfile, error: selectError } = await authedSupabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled || selectError) {
        return
      }

      if (!existingProfile) {
        await authedSupabase.from("profiles").upsert(
          {
            id: user.id,
            full_name: user.fullName ?? "",
            email: user.primaryEmailAddress?.emailAddress ?? "",
          },
          { onConflict: "id" }
        )
      }
    }

    void syncProfile()

    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn, user, userLoaded])

  return null
}
