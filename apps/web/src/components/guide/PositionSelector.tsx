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
          className={`px-4 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
            selected === pos.key
              ? "bg-white text-black border-white"
              : "bg-transparent text-[#666] border-[#333] hover:border-[#555] hover:text-[#999]"
          }`}
        >
          {pos.label}
        </button>
      ))}
    </div>
  );
}
