import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Zap, BrainCircuit } from 'lucide-react';
import { ModelId, ModelConfig } from '../types';

interface ModelSelectorProps {
  currentModel: ModelId;
  onModelChange: (model: ModelId) => void;
  disabled: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onModelChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const icons = {
    [ModelId.Flash]: <Zap size={18} className="text-yellow-400" />,
    [ModelId.Pro]: <Sparkles size={18} className="text-purple-400" />,
    [ModelId.FlashThinking]: <BrainCircuit size={18} className="text-blue-400" />
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-200 font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span>{ModelConfig[currentModel].label}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-1">
            {Object.values(ModelId).map((modelId) => (
              <button
                key={modelId}
                onClick={() => {
                  onModelChange(modelId);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                  currentModel === modelId ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                }`}
              >
                <div className="flex-shrink-0">
                  {icons[modelId]}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    {ModelConfig[modelId].label}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ModelConfig[modelId].description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;