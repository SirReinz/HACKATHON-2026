import * as React from "react"
import { useUser } from "@clerk/clerk-react"

import { supabase } from "@/lib/supabase"

export function UserSync() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser()

  React.useEffect(() => {
    if (!userLoaded || !isSignedIn || !user) {
      return
    }

    let cancelled = false

    const syncProfile = async () => {
      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled || selectError) {
        return
      }

      if (!existingProfile) {
        await supabase.from("profiles").upsert(
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
  }, [isSignedIn, user, userLoaded])

  return null
}
