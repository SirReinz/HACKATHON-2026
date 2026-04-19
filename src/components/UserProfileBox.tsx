import * as React from "react"
import { SignOutButton, useUser } from "@clerk/clerk-react"
import { Settings2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from "@/lib/supabase"

type ProfileFormValues = {
  fullName: string
  email: string
  company: string
  role: string
}

function initialsFromName(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) {
    return "U"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function UserProfileBox() {
  const { user } = useUser()
  const [open, setOpen] = React.useState(false)

  const fullName = user?.fullName ?? "User"
  const email = user?.primaryEmailAddress?.emailAddress ?? "No email"

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      fullName,
      email,
      company: "",
      role: "Owner",
    },
  })

  React.useEffect(() => {
    form.reset({
      fullName,
      email,
      company: form.getValues("company"),
      role: form.getValues("role") || "Owner",
    })
  }, [email, form, fullName])

  React.useEffect(() => {
    if (!open || !user) {
      return
    }

    let cancelled = false

    const loadProfile = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, email, company, role")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled || error || !profile) {
        return
      }

      form.reset({
        fullName: profile.full_name || fullName,
        email: profile.email || email,
        company: profile.company || "",
        role: profile.role || "Owner",
      })
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [email, form, fullName, open, user])

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      return
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: values.fullName,
        email: values.email,
        company: values.company,
        role: values.role,
      },
      { onConflict: "id" }
    )

    if (error) {
      toast.error("Failed to update profile telemetry.")
      return
    }

    toast.success("Profile telemetry updated successfully.")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-foreground transition-colors hover:bg-accent/60 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-100 dark:hover:bg-slate-800/70"
        >
            <div className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-foreground dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initialsFromName(fullName)}</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName}</p>
              <p className="text-xs text-muted-foreground">Profile</p>
            </div>

            <span
              className="ml-auto inline-flex size-6 items-center justify-center rounded-full text-muted-foreground dark:text-slate-300"
              aria-hidden="true"
            >
              <Settings2 className="size-3.5" />
            </span>
        </button>
      </DialogTrigger>

      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] md:max-w-250 overflow-hidden border-border/50 bg-background/90 p-0 shadow-2xl backdrop-blur-md">
        <div className="grid max-h-[88svh] grid-cols-1 gap-0 md:grid-cols-3">
          <aside className="col-span-1 border-b border-border/50 bg-muted/30 p-6 md:border-r md:border-b-0">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-20 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-semibold">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initialsFromName(fullName)}</span>
                )}
              </div>
              <p className="text-base font-semibold">{fullName}</p>
              <p className="mt-1 text-sm text-muted-foreground break-all">{email}</p>
            </div>
          </aside>

          <div className="col-span-2 min-h-0">
            <DialogHeader className="border-b border-border/60 p-8 pb-5">
              <DialogTitle>Profile Settings</DialogTitle>
            </DialogHeader>

            <ScrollArea className="h-[56svh] lg:h-[62svh]">
              <div className="p-8 pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      rules={{ required: "Full Name is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} disabled readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company/Enterprise</FormLabel>
                          <FormControl>
                            <Input placeholder="AXEL Enterprise" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <select
                              value={field.value}
                              onChange={field.onChange}
                              className="flex h-9 w-full rounded-2xl border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                            >
                              <option value="Owner">Owner</option>
                              <option value="Marketer">Marketer</option>
                              <option value="Developer">Developer</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-5">
                      <SignOutButton>
                        <Button type="button" variant="outline">
                          Sign Out
                        </Button>
                      </SignOutButton>
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </Form>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
