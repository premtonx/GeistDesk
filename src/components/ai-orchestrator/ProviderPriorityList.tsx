import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

const MODEL_LABELS: Record<string, string> = {
  'gpt-5': 'GPT-5',
  claude: 'Claude Sonnet',
  'gemini-flash': 'Gemini Flash',
  'local-llama': 'Local Llama',
  'gemini-pro': 'Gemini Pro',
};

interface ProviderPriorityListProps {
  items: string[];
  disabled?: boolean;
  onChange: (items: string[]) => void;
}

export function ProviderPriorityList({ items, disabled, onChange }: ProviderPriorityListProps) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || disabled) return;
    const next = [...items];
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    onChange(next);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="provider-priority">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
            {items.map((model, index) => (
              <Draggable key={model} draggableId={model} index={index} isDragDisabled={disabled}>
                {(dragProvided, snapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border bg-white',
                      snapshot.isDragging ? 'border-indigo-300 shadow-md' : 'border-slate-100',
                      disabled && 'opacity-60',
                    )}
                  >
                    <span className="text-xs font-black text-slate-400 w-5">{index + 1}</span>
                    <span {...dragProvided.dragHandleProps} className="cursor-grab text-slate-400">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {MODEL_LABELS[model] ?? model}
                    </span>
                    {index === 0 && (
                      <span className="ml-auto text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
