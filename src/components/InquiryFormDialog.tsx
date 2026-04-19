import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"

import { useInquiryFlow } from "@/context/InquiryFlowContext"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PLACE_CATEGORY_OPTIONS } from "@/lib/place-categories"

type InquiryFormValues = {
  businessType: string
  spendingBracket: "$" | "$$" | "$$$"
}

type InquiryFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InquiryFormDialog({ open, onOpenChange }: InquiryFormDialogProps) {
  const navigate = useNavigate()
  const { setDraft } = useInquiryFlow()
  const [businessOpen, setBusinessOpen] = React.useState(false)
  const [spendOpen, setSpendOpen] = React.useState(false)
  const businessListRef = React.useRef<HTMLDivElement | null>(null)
  const spendListRef = React.useRef<HTMLDivElement | null>(null)

  const form = useForm<InquiryFormValues>({
    defaultValues: {
      businessType: "",
      spendingBracket: "$$",
    },
    mode: "onChange",
  })

  React.useEffect(() => {
    if (!open) {
      form.reset({ businessType: "", spendingBracket: "$$" })
      setBusinessOpen(false)
      setSpendOpen(false)
    }
  }, [form, open])

  const handleSubmit = (values: InquiryFormValues) => {
    setDraft(values)
    onOpenChange(false)
    navigate("/inquiry/results")
  }

  const handleWheelScroll = (event: React.WheelEvent<HTMLDivElement>, target: HTMLDivElement | null) => {
    if (!target) {
      return
    }

    event.preventDefault()
    target.scrollTop += event.deltaY
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          navigate("/dashboard", { replace: true })
        }
      }}
    >
      <DialogContent className="max-h-[90svh] w-[min(92vw,42rem)] overflow-hidden border-border/50 bg-background p-0 shadow-2xl">
        <div className="max-h-[90svh] overflow-y-auto">
          <DialogHeader className="border-b border-border/50 px-6 py-5">
            <DialogTitle className="text-2xl">New Location Inquiry</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Define your business profile so AXEL can tailor each suburb recommendation.
            </p>
          </DialogHeader>

          <div className="px-6 py-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="businessType"
                  rules={{ required: "Business type is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <FormControl>
                        <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={businessOpen}
                              className="h-11 w-full justify-between border-border bg-background px-3 text-left text-sm font-normal text-foreground hover:bg-accent"
                            >
                              <span className="truncate">
                                {field.value || "Select business type"}
                              </span>
                              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] border-border bg-popover p-0 shadow-xl"
                            align="start"
                          >
                            <Command className="bg-popover text-popover-foreground">
                              <CommandInput placeholder="Search business type..." />
                              <div
                                ref={businessListRef}
                                className="max-h-60 overflow-y-auto overflow-x-hidden overscroll-contain"
                                onWheel={(event) => handleWheelScroll(event, businessListRef.current)}
                              >
                                <CommandList className="max-h-none overflow-visible">
                                  <CommandEmpty>No business types found.</CommandEmpty>
                                  <CommandGroup>
                                    {PLACE_CATEGORY_OPTIONS.map((category) => {
                                      const isActive = field.value === category

                                      return (
                                        <CommandItem
                                          key={category}
                                          value={category}
                                          onSelect={() => {
                                            field.onChange(category)
                                            setBusinessOpen(false)
                                          }}
                                        >
                                          <Check className={`size-4 ${isActive ? "opacity-100" : "opacity-0"}`} />
                                          <span className="truncate">{category}</span>
                                        </CommandItem>
                                      )
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </div>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                        <Popover open={spendOpen} onOpenChange={setSpendOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={spendOpen}
                              className="h-11 w-full justify-between border-border bg-background px-3 text-left text-sm font-normal text-foreground hover:bg-accent"
                            >
                              <span className="truncate">{field.value}</span>
                              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] border-border bg-popover p-0 shadow-xl"
                            align="start"
                          >
                            <Command className="bg-popover text-popover-foreground">
                              <CommandInput placeholder="Search spending bracket..." />
                              <div
                                ref={spendListRef}
                                className="max-h-60 overflow-y-auto overflow-x-hidden overscroll-contain"
                                onWheel={(event) => handleWheelScroll(event, spendListRef.current)}
                              >
                                <CommandList className="max-h-none overflow-visible">
                                  <CommandEmpty>No spending brackets found.</CommandEmpty>
                                  <CommandGroup>
                                    {(["$", "$$", "$$$"] as const).map((bracket) => {
                                      const isActive = field.value === bracket

                                      return (
                                        <CommandItem
                                          key={bracket}
                                          value={bracket}
                                          onSelect={() => {
                                            field.onChange(bracket)
                                            setSpendOpen(false)
                                          }}
                                        >
                                          <Check className={`size-4 ${isActive ? "opacity-100" : "opacity-0"}`} />
                                          <span className="truncate">{bracket}</span>
                                        </CommandItem>
                                      )
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </div>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-2xl">
                    Get your recommendations
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}