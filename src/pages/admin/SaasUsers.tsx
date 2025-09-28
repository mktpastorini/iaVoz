"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, UserPlus } from 'lucide-react';

import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SaasUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

const userSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido."),
  role: z.enum(['admin', 'member'], { required_error: "A função é obrigatória." }),
});

type UserFormData = z.infer<typeof userSchema>;

const SaasUsersPage: React.FC = () => {
  const { workspace, user: adminUser, role } = useSession(); // Adicionando role
  const [users, setUsers] = useState<SaasUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SaasUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SaasUser | null>(null);

  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const fetchUsers = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-workspace-users', {
        body: { workspace_id: workspace.id },
      });
      if (error) throw error;
      setUsers(data);
    } catch (error: any) {
      showError("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenForm = (user: SaasUser | null) => {
    setEditingUser(user);
    reset(user ? { email: user.email, role: user.role } : { email: '', role: 'member' });
    setIsFormOpen(true);
  };

  const onSubmit = async (formData: UserFormData) => {
    if (!workspace?.id) return;
    try {
      let error;
      if (editingUser) {
        // Lógica de Edição
        const { error: updateError } = await supabase.functions.invoke('update-user-role', {
          body: { user_id: editingUser.id, workspace_id: workspace.id, role: formData.role },
        });
        error = updateError;
      } else {
        // Lógica de Adição (Convite)
        const { error: inviteError } = await supabase.functions.invoke('invite-user', {
          body: { email: formData.email, workspace_id: workspace.id, role: formData.role },
        });
        error = inviteError;
      }
      if (error) throw error;
      showSuccess(`Usuário ${editingUser ? 'atualizado' : 'convidado'} com sucesso!`);
      setIsFormOpen(false);
      fetchUsers();
    } catch (error: any) {
      showError(`Erro: ${error.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: deletingUser.id },
      });
      if (error) throw error;
      showSuccess("Usuário excluído com sucesso.");
      setDeletingUser(null);
      fetchUsers();
    } catch (error: any) {
      showError(`Erro ao excluir usuário: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        {role === 'admin' && ( // Apenas admin pode adicionar
          <Button onClick={() => handleOpenForm(null)}>
            <UserPlus className="mr-2 h-4 w-4" /> Adicionar Usuário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Usuários do Workspace</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Data de Entrada</TableHead>
                {role === 'admin' && <TableHead><span className="sr-only">Ações</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={role === 'admin' ? 5 : 4} className="text-center">Carregando...</TableCell></TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.first_name || user.email.split('@')[0]}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    {role === 'admin' && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}>
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenForm(user)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingUser(user)}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={role === 'admin' ? 5 : 4} className="text-center">Nenhum usuário encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Adicionar/Editar Usuário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Convidar Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Altere a função do usuário.' : 'Envie um convite por e-mail para um novo membro se juntar ao seu workspace.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...register("email")} disabled={!!editingUser} />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="role">Função</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-destructive text-sm mt-1">{errors.role.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta de Exclusão */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá remover permanentemente o usuário <strong>{deletingUser?.email}</strong> do seu workspace e de todo o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Sim, excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SaasUsersPage;