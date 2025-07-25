"use client"

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { SortableRow } from './SortableRow';
import { InstitutionalProject } from './columns';

interface DraggableDataTableProps {
  items: InstitutionalProject[];
  setItems: React.Dispatch<React.SetStateAction<InstitutionalProject[]>>;
  onEdit: (project: InstitutionalProject) => void;
  onDelete: (id: string) => void;
}

export function DraggableDataTable({ items, setItems, onEdit, onDelete }: DraggableDataTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
  }

  // Definindo as colunas aqui para simplicidade
  const tableHeaders = ["", "Ordem", "Imagem", "Título", "Ações"];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {tableHeaders.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <SortableRow 
                  key={item.id} 
                  id={item.id} 
                  project={item}
                  order={index + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </SortableContext>
    </DndContext>
  );
} 