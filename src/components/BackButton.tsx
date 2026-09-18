"use client";

type Props = { onBack: () => void };

/** Only rendered in the selected state. Fades in after the name starts rising. */
export default function BackButton({ onBack }: Props) {
  return (
    <button type="button" className="back-button" data-back onClick={onBack} aria-label="Back to character select">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M15 5 8 12l7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
