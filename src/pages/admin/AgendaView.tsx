"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, parse, setHours, setMinutes, getHours, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Copy, Video, Building } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';

// Tipos
interface Client {
  id: string;
  name: string;
  email: string | null;
}

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: 'meet' | 'presential' | 'other';
  meet_link: string | null;
  clients: { name: string };
}

// Schema de validação do formulário
const eventSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente válido"),
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres"),
  date: z.date({ required_error: "A data é obrigatória" }),
  start_time_str: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)"),
  end_time_str: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)"),
  event_type: z.enum(['meet', 'presential', 'other'], { required_error: "Selecione o tipo de evento" }),
  description: z.string().optional(),
}).refine(data => data.end_time_str > data.start_time_str, {
  message: "O horário final deve ser após o horário inicial",
  path: ["end_time_str"],
});

type EventFormData = z.infer<typeof eventSchema>;

const AgendaView: React.FC = () => {
  const { workspace, user, loading: sessionLoading } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!workspace?.id) return;
    const { data, error } = await supabase.from('clients').select('id, name, email').eq('workspace_id', workspace.id);
    if (error) showError("Erro ao carregar clientes.");
    else setClients(data || []);
  }, [workspace]);

  const fetchEvents = useCallback(async (date: Date) => {
    if (!workspace?.id) return;
    setLoading(true);
    const start = startOfWeek(date, { locale: ptBR });
    const end = endOfWeek(date, { locale: ptBR });

    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, event_type, meet_link, clients(name)')
      .eq('workspace_id', workspace.id)
      .gte('start_time', start.toISOString())
      .lte('end_time', end.toISOString());

    if (error) showError("Erro ao carregar eventos.");
    else setEvents(data as Event[] || []);
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    if (!sessionLoading && workspace) {
      fetchClients();
      fetchEvents(currentDate);
    }
  }, [workspace, sessionLoading, currentDate, fetchClients, fetchEvents]);

  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: { event_type: 'meet' }
  });

  const onSubmit = async (formData: EventFormData) => {
    if (!workspace || !user) return;

    const { date, start_time_str, end_time_str, ...rest } = formData;
    const [startHours, startMinutes] = start_time_str.split(':').map(Number);
    const [endHours, endMinutes] = end_time_str.split(':').map(Number);

    const start_time = setMinutes(setHours(date, startHours), startMinutes);
    const end_time = setMinutes(setHours(date, endHours), endMinutes);

    let meet_link = null;
    let google_event_id = null;

    if (formData.event_type === 'meet') {
      const toastId = showLoading("Gerando link da reunião no Google Calendar...");
      try {
        const selectedClient = clients.find(c => c.id === formData.client_id);
        const { data: googleEventData, error: functionError } = await supabase.functions.invoke('create-google-event', {
          body: {
            title: formData.title,
            description: formData.description,
            startTime: start_time.toISOString(),
            endTime: end_time.toISOString(),
            clientEmail: selectedClient?.email,
          }
        });

        if (functionError) throw functionError;

        meet_link = googleEventData.meetLink;
        google_event_id = googleEventData.googleEventId;
        dismissToast(toastId);
        showSuccess("Reunião criada no Google Calendar!");
      } catch (error: any) {
        dismissToast(toastId);
        showError(error.data?.error || "Falha ao criar evento no Google. Verifique se sua conta Google está conectada nas configurações.");
        console.error(error);
        return;
      }
    }

    const { error } = await supabase.from('events').insert({
      ...rest,
      start_time: start_time.toISOString(),
      end_time: end_time.toISOString(),
      meet_link,
      google_event_id,
      workspace_id: workspace.id,
      user_id: user.id,
    });

    if (error) {
      showError("Erro ao salvar evento no sistema.");
      console.error(error);
    } else {
      showSuccess("Evento salvo com sucesso!");
      setIsModalOpen(false);
      reset();
      fetchEvents(currentDate);
    }
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { locale: ptBR }), i));
  const timeSlots = Array.from({ length: 11 }).map((_, i) => `${String(i + 8).padStart(2, '0')}:00`);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    showSuccess("Link da reunião copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl md:text-2xl font-bold text-center">
            {format(startOfWeek(currentDate, { locale: ptBR }), 'd MMM', { locale: ptBR })} - {format(endOfWeek(currentDate, { locale: ptBR }), 'd MMM yyyy', { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button onClick={() => { reset(); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Evento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-t border-l">
            {weekDays.map(day => (
              <div key={day.toString()} className="p-2 border-b border-r text-center font-semibold">
                <span className="hidden md:inline">{format(day, 'EEEE', { locale: ptBR })}</span>
                <span className="md:hidden">{format(day, 'EEE', { locale: ptBR })}</span>
                <br />
                <span className={cn("text-sm", isSameDay(day, new Date()) && "text-blue-600 font-bold")}>{format(day, 'd')}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l h-[60vh] overflow-y-auto">
            {weekDays.map(day => (
              <div key={day.toString()} className="relative border-r">
                {timeSlots.map(time => (
                  <div key={time} className="h-16 border-b text-xs text-gray-400 p-1">{time}</div>
                ))}
                {events.filter(e => isSameDay(parse(e.start_time, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date()), day)).map(event => {
                  const startHour = getHours(new Date(event.start_time));
                  const duration = (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / (1000 * 60 * 60);
                  const top = (startHour - 8) * 4;
                  const height = duration * 4;

                  const eventTypeIcons = {
                    meet: <Video className="h-4 w-4 text-blue-500" />,
                    presential: <Building className="h-4 w-4 text-orange-500" />,
                    other: <div className="h-4 w-4" />
                  };

                  return (
                    <div key={event.id} className="absolute w-full p-2" style={{ top: `${top}rem`, height: `${height}rem` }}>
                      <div className="bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-lg p-2 h-full overflow-hidden text-xs">
                        <p className="font-bold truncate">{event.title}</p>
                        <p className="flex items-center gap-1"><User className="h-3 w-3" /> {event.clients.name}</p>
                        <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {eventTypeIcons[event.event_type]}
                          {event.event_type === 'meet' && event.meet_link && (
                            <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => handleCopyLink(event.meet_link!)}><Copy className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Novo Evento</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Controller name="client_id" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>)} />
              {errors.client_id && <p className="text-destructive text-sm mt-1">{errors.client_id.message}</p>}
            </div>
            <div><Label>Título do Evento</Label><Input {...register("title")} />{errors.title && <p className="text-destructive text-sm mt-1">{errors.title.message}</p>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Data</Label>
                <Controller name="date" control={control} render={({ field }) => (
                  <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal">{field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>)} />
                {errors.date && <p className="text-destructive text-sm mt-1">{errors.date.message}</p>}
              </div>
              <div><Label>Tipo de Evento</Label>
                <Controller name="event_type" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="meet">Reunião (Meet)</SelectItem><SelectItem value="presential">Reunião (Presencial)</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent>
                  </Select>)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horário de Início</Label><Input type="time" {...register("start_time_str")} />{errors.start_time_str && <p className="text-destructive text-sm mt-1">{errors.start_time_str.message}</p>}</div>
              <div><Label>Horário de Fim</Label><Input type="time" {...register("end_time_str")} />{errors.end_time_str && <p className="text-destructive text-sm mt-1">{errors.end_time_str.message}</p>}</div>
            </div>
            <div><Label>Descrição (Opcional)</Label><Textarea {...register("description")} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar Evento"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgendaView;