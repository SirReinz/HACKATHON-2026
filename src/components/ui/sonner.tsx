import { Toaster as Sonner } from "sonner"

import { useTheme } from "@/components/theme-provider"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme === "system" ? "system" : theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border-border bg-card text-card-foreground shadow-lg",
          title: "text-foreground",
          description: "text-muted-foreground",
          success: "text-emerald-600 dark:text-emerald-400",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
