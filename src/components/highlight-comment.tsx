'use client'

import { useState, useCallback, useRef } from 'react'

interface FloatingMenuState {
  x: number
  y: number
  text: string
}

interface ModalState {
  type: 'suggest' | 'question'
  selectedText: string
}

export function HighlightComment({ children }: { children: React.ReactNode }) {
  const [floating, setFloating] = useState<FloatingMenuState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [formText, setFormText] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setFloating(null)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    setFloating({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      text: selection.toString().trim(),
    })
  }, [])

  function openModal(type: 'suggest' | 'question') {
    if (!floating) return
    setModal({ type, selectedText: floating.text })
    setFloating(null)
    setFormText('')
    window.getSelection()?.removeAllRanges()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log('Submission:', {
      type: modal?.type,
      selectedText: modal?.selectedText,
      message: formText,
    })
    setModal(null)
    setFormText('')
  }

  return (
    <div ref={containerRef} className="relative" onMouseUp={handleMouseUp}>
      {children}

      {/* Floating popover */}
      {floating && (
        <div
          className="absolute z-20 flex gap-1 bg-[#1a1a1a] text-white rounded-lg px-2 py-1.5 shadow-lg text-xs -translate-x-1/2 -translate-y-full"
          style={{ left: floating.x, top: floating.y }}
        >
          <button
            onClick={() => openModal('suggest')}
            className="px-2 py-0.5 rounded hover:bg-white/10 whitespace-nowrap"
          >
            Suggest edit
          </button>
          <button
            onClick={() => openModal('question')}
            className="px-2 py-0.5 rounded hover:bg-white/10 whitespace-nowrap"
          >
            Ask question
          </button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-medium text-[#1a1a1a] mb-1">
              {modal.type === 'suggest' ? 'Suggest an edit' : 'Ask a question'}
            </h3>
            <p className="text-xs text-gray-400 mb-4 italic truncate">
              &ldquo;{modal.selectedText}&rdquo;
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={modal.type === 'suggest' ? 'What should be corrected?' : 'What would you like to know?'}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formText.trim()}
                  className="text-sm bg-[#1a1a1a] text-white px-4 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-40"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
