"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PlusCircle } from 'lucide-react';

// Interface genérica para os itens do popover
interface PopoverItem {
  id: string;
  name: string;
}

interface FieldInsertPopoverProps {
  fields: PopoverItem[];
  onInsert: (fieldName: string) => void;
  label?: string; // Adicionar um label opcional para o botão
}

export const FieldInsertPopover: React.FC<FieldInsertPopoverProps> = ({ fields, onInsert, label = "Inserir Campo" }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2 h-8">
          <PlusCircle className="mr-2 h-4 w-4" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {fields.map((field) => (
                <CommandItem
                  key={field.id}
                  value={field.name}
                  onSelect={() => {
                    onInsert(field.name);
                    setOpen(false);
                  }}
                >
                  {field.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};