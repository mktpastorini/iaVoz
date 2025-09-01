"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PlusCircle } from 'lucide-react';

// Interface para o tipo de dado do campo do usuário
interface UserDataField {
  id: string;
  name: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
}

interface FieldInsertPopoverProps {
  fields: UserDataField[];
  onInsert: (fieldName: string) => void;
}

export const FieldInsertPopover: React.FC<FieldInsertPopoverProps> = ({ fields, onInsert }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2 h-8">
          <PlusCircle className="mr-2 h-4 w-4" /> Inserir Campo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar campo..." />
          <CommandList>
            <CommandEmpty>Nenhum campo encontrado.</CommandEmpty>
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