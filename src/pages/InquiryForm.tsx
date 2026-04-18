import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"

import { useInquiryFlow } from "@/context/InquiryFlowContext"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PLACE_CATEGORY_OPTIONS } from "@/lib/place-categories"

type InquiryFormValues = {
  businessType: string
  spendingBracket: "$" | "$$" | "$$$"
}

export function InquiryFormPage() {
  const navigate = useNavigate()
  const { setDraft } = useInquiryFlow()

  const form = useForm<InquiryFormValues>({
    defaultValues: {
      businessType: "",
      spendingBracket: "$$",
    },
    mode: "onChange",
  })

  const onSubmit = (values: InquiryFormValues) => {
    setDraft(values)
    navigate("/inquiry/results")
  }

  return (
    <main className="min-h-svh bg-linear-to-br from-slate-100 via-slate-50 to-cyan-100 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/50">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-3xl items-center justify-center">
        <Card className="w-full border-border/50 bg-background/65 shadow-2xl shadow-primary/15 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl">New Location Inquiry</CardTitle>
            <CardDescription>
              Define your business profile so AXEL can tailor each suburb recommendation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="businessType"
                  rules={{ required: "Business type is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="" disabled>
                            Select business type
                          </option>
                          {PLACE_CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="spendingBracket"
                  rules={{ required: "Spending bracket is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spending Bracket</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="$">$</option>
                          <option value="$$">$$</option>
                          <option value="$$$">$$$</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-2xl">
                    See 3D Results
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
