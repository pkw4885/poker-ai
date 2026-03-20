"use client";

const POSITIONS = [
  { key: "UTG", label: "UTG", desc: "Under the Gun" },
  { key: "MP", label: "MP", desc: "Middle Position" },
  { key: "CO", label: "CO", desc: "Cutoff" },
  { key: "BTN", label: "BTN", desc: "Button (Dealer)" },
  { key: "SB", label: "SB", desc: "Small Blind" },
  { key: "BB", label: "BB", desc: "Big Blind" },
];

interface PositionSelectorProps {
  selected: string;
  onSelect: (position: string) => void;
}

export default function PositionSelector({
  selected,
  onSelect,
}: PositionSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {POSITIONS.map((pos) => (
        <button
          key={pos.key}
          onClick={() => onSelect(pos.key)}
          title={pos.desc}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selected === pos.key
              ? "bg-emerald-600 text-white"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
        >
          {pos.label}
        </button>
      ))}
    </div>
  );
}
