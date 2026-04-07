"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CommandPalette } from "@/components/command/command-palette"

export function KeyboardShortcuts() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const router = useRouter()

  const isInputFocused = () => {
    const el = document.activeElement
    if (!el) return false
    return (
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
      (el as HTMLElement).isContentEditable
    )
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+K → command palette (always, even in inputs)
      if (mod && e.key === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }

      // Skip remaining shortcuts when in input fields
      if (isInputFocused()) return

      // ? → shortcut help (now just opens command palette)
      if (e.key === "?" && !mod) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // Cmd+J → Command center
      if (mod && e.key === "j") {
        e.preventDefault()
        router.push("/command")
        return
      }

      // Cmd+N → new contact
      if (mod && e.key === "n") {
        e.preventDefault()
        router.push("/crm?new=1")
        return
      }

      // Cmd+E → new email
      if (mod && e.key === "e") {
        e.preventDefault()
        router.push("/outreach?new=1")
        return
      }

      // Cmd+Shift+S → new shoot
      if (mod && e.shiftKey && e.key === "S") {
        e.preventDefault()
        router.push("/operations/shoots?new=1")
        return
      }
    },
    [router]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <CommandPalette
      isOpen={paletteOpen}
      onClose={() => setPaletteOpen(false)}
    />
  )
}
