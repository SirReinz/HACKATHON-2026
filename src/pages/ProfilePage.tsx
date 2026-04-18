import { useForm } from "react-hook-form"
import { useUser } from "@clerk/clerk-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

type ProfileSettingsForm = {
  company: string
  role: string
}

export function ProfilePage() {
  const { user } = useUser()

  const form = useForm<ProfileSettingsForm>({
    defaultValues: {
      company: "",
      role: "",
    },
    mode: "onChange",
  })

  const onSubmit = (values: ProfileSettingsForm) => {
    console.log("AXEL Profile Settings", values)
    toast.success("Profile settings saved")
  }

  return (
    <main className="min-h-svh bg-background p-6 md:p-10">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Name</p>
              <p className="mt-1 text-base font-medium text-foreground">
                {user?.fullName ?? "Not available"}
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Email</p>
              <p className="mt-1 text-base font-medium text-foreground break-all">
                {user?.primaryEmailAddress?.emailAddress ?? "Not available"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="company"
                  rules={{ required: "Company/Enterprise is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company/Enterprise</FormLabel>
                      <FormControl>
                        <Input placeholder="AXEL Ventures" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  rules={{ required: "Role is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <Input placeholder="Growth Analyst" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button type="submit" className="rounded-2xl" size="lg">
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
