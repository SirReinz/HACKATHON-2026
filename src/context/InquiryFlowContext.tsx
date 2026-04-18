import * as React from "react"

export type InquiryDraft = {
  businessType: string
  targetAudience: string
  spendingBracket: "$" | "$$" | "$$$"
}

type InquiryFlowContextValue = {
  draft: InquiryDraft | null
  setDraft: (draft: InquiryDraft | null) => void
}

const InquiryFlowContext = React.createContext<InquiryFlowContextValue | undefined>(undefined)

export function InquiryFlowProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = React.useState<InquiryDraft | null>(null)

  const value = React.useMemo(
    () => ({
      draft,
      setDraft,
    }),
    [draft]
  )

  return <InquiryFlowContext.Provider value={value}>{children}</InquiryFlowContext.Provider>
}

export function useInquiryFlow() {
  const context = React.useContext(InquiryFlowContext)

  if (!context) {
    throw new Error("useInquiryFlow must be used within InquiryFlowProvider")
  }

  return context
}
